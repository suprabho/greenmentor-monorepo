"""
Unified document → markdown normalization layer.

Routes each input format to the best local parser and returns a single
ParsedDocument (markdown plus per-page text blocks with bounding boxes). The
scan/extract agents work off this normalized representation instead of
format-specific raw text, which gives us, in one place:

  - better table accuracy  — spatial/structured markdown beats raw text dumps
  - new file formats        — docx / pptx / odt / rtf / html
  - lower LLM cost          — scanned pages are OCR'd locally (Tesseract) instead
                              of being shipped to Claude vision
  - provenance              — bounding boxes + page numbers per text block

Routing:
  PDF, images        → liteparse  (local Tesseract OCR, spatial markdown, bboxes)
  DOCX/PPTX/ODT/RTF  → markitdown (clean markdown tables; adds new formats)
  HTML / HTM         → markitdown
  XLSX/XLS/CSV       → NOT handled here. excel_agent owns these — its custom
                       merged-cell / header-detection pipeline is superior to a
                       generic markdown conversion, so parse_document refuses them.

Both libraries are imported lazily so the app still starts if they (or their
system backends) are not installed; the error surfaces only when a parse is
actually attempted.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger("efdb.extraction.parser")

# Extension → route. Excel/CSV are deliberately absent (handled by excel_agent).
LITEPARSE_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif", ".webp"}
MARKITDOWN_EXTS = {".docx", ".doc", ".pptx", ".ppt", ".odt", ".odp", ".rtf", ".html", ".htm"}
EXCEL_EXTS = {".xlsx", ".xls", ".csv"}


@dataclass
class ParsedBlock:
    """A single text block with optional source coordinates."""
    text: str
    page: int                              # 1-based
    bbox: list[float] | None = None        # [x1, y1, x2, y2] in page coords
    confidence: float | None = None        # OCR confidence 0..1 when available


@dataclass
class ParsedPage:
    """One page/slide/section of the parsed document."""
    page_num: int                          # 1-based
    markdown: str = ""
    blocks: list[ParsedBlock] = field(default_factory=list)
    used_ocr: bool = False


@dataclass
class ParsedDocument:
    """Normalized representation handed to the scan/extract agents."""
    markdown: str
    pages: list[ParsedPage]
    source_format: str                     # file extension, lower-case, incl. dot
    parser: str                            # "liteparse" | "markitdown"
    used_ocr: bool = False

    @property
    def page_count(self) -> int:
        return len(self.pages)

    def page_markdown(self, page_num: int) -> str:
        """Markdown for a single 1-based page (empty string if out of range)."""
        for p in self.pages:
            if p.page_num == page_num:
                return p.markdown
        return ""


def route_for(file_path: str) -> str:
    """Return the parser name a path would route to: 'liteparse' | 'markitdown' | 'excel'.

    Raises ValueError for unknown extensions so callers fail loudly rather than
    silently mis-parsing."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in LITEPARSE_EXTS:
        return "liteparse"
    if ext in MARKITDOWN_EXTS:
        return "markitdown"
    if ext in EXCEL_EXTS:
        return "excel"
    raise ValueError(f"No parser route for extension {ext!r} ({file_path})")


def parse_document(file_path: str, mime_type: str | None = None) -> ParsedDocument:
    """Parse any supported non-spreadsheet document into a ParsedDocument.

    Spreadsheets (.xlsx/.xls/.csv) raise — they are handled by excel_agent, whose
    merged-cell pipeline is not something we want to bypass.
    """
    route = route_for(file_path)
    if route == "excel":
        raise ValueError(
            f"{os.path.basename(file_path)} is a spreadsheet — route it through "
            "excel_agent, not document_parser (its merged-cell handling is superior)."
        )
    if route == "liteparse":
        return _parse_with_liteparse(file_path)
    return _parse_with_markitdown(file_path)


# ── liteparse (PDF + images) ────────────────────────────────────────────────

def _parse_with_liteparse(file_path: str) -> ParsedDocument:
    """Parse a PDF/image with liteparse: spatial markdown + per-block bboxes.

    OCR runs locally via Tesseract for pages with no embedded text. Bounding-box
    and confidence attributes are read defensively (liteparse exposes text items
    per page; attribute names can vary across versions), so provenance degrades
    gracefully to None rather than raising.
    """
    try:
        from liteparse import LiteParse
    except ImportError as e:
        raise RuntimeError(
            "liteparse is not installed. `pip install liteparse` and ensure the "
            "system packages tesseract-ocr, libreoffice and imagemagick are present."
        ) from e

    ext = os.path.splitext(file_path)[1].lower()
    parser = LiteParse(
        ocr_enabled=True,
        ocr_language="eng",
        output_format="markdown",
        image_mode="placeholder",
        extract_links=True,
    )
    result = parser.parse(file_path)

    # Per-page: liteparse exposes text_items with x/y/width/height + confidence
    # (there is no `bbox` attribute). The rich markdown reconstruction lives at
    # the document level (result.text); per-page `.text` is plainer, used only
    # for sampling/vision-fallback decisions and bbox provenance.
    pages: list[ParsedPage] = []
    doc_used_ocr = False
    for raw_page in getattr(result, "pages", []) or []:
        page_num = int(getattr(raw_page, "page_num", len(pages) + 1))
        blocks: list[ParsedBlock] = []
        page_ocr = False
        for item in getattr(raw_page, "text_items", []) or []:
            text = (getattr(item, "text", None) or "").strip()
            if not text:
                continue
            conf = _as_float(getattr(item, "confidence", None))
            # OCR'd items carry a sub-1.0 confidence; native-text items report 1.0.
            if conf is not None and conf < 1.0:
                page_ocr = True
            blocks.append(ParsedBlock(
                text=text,
                page=page_num,
                bbox=_bbox_from_xywh(item),
                confidence=conf,
            ))
        doc_used_ocr = doc_used_ocr or page_ocr
        pages.append(ParsedPage(
            page_num=page_num,
            markdown=getattr(raw_page, "text", "") or "",
            blocks=blocks,
            used_ocr=page_ocr,
        ))

    # Fall back to a single synthetic page if liteparse didn't expose pages.
    if not pages:
        pages = [ParsedPage(page_num=1, markdown=getattr(result, "text", "") or "")]

    return ParsedDocument(
        markdown=getattr(result, "text", "") or "\n\n".join(p.markdown for p in pages),
        pages=pages,
        source_format=ext,
        parser="liteparse",
        used_ocr=doc_used_ocr,
    )


def _bbox_from_xywh(item) -> list[float] | None:
    """Build [x1, y1, x2, y2] from a liteparse text item's x/y/width/height."""
    try:
        x, y = float(item.x), float(item.y)
        w, h = float(item.width), float(item.height)
        return [x, y, x + w, y + h]
    except (AttributeError, TypeError, ValueError):
        return None


def _as_float(value) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def liteparse_screenshots(file_path: str, page_numbers: list[int]) -> dict[int, bytes]:
    """Render specific 1-based pages to PNG bytes for the Claude-vision fallback.

    Used when liteparse OCR returns no usable text for a page — we hand that page
    to Claude vision instead. Returns {page_num: png_bytes}; pages that fail to
    render are simply omitted.
    """
    try:
        from liteparse import LiteParse
    except ImportError as e:
        raise RuntimeError("liteparse is not installed.") from e

    out: dict[int, bytes] = {}
    try:
        shots = LiteParse().screenshot(file_path, page_numbers=page_numbers)
    except Exception as e:  # screenshot is best-effort; never block extraction
        logger.warning("liteparse screenshot failed for %s: %r", file_path, e)
        return out
    for s in shots or []:
        num = getattr(s, "page_num", None)
        img = getattr(s, "image_bytes", None)
        if num is not None and img:
            out[int(num)] = img
    return out


# ── markitdown (office + html) ──────────────────────────────────────────────

def _parse_with_markitdown(file_path: str) -> ParsedDocument:
    """Convert an office/html document to markdown with markitdown.

    markitdown produces a single markdown string with no page coordinates, so
    provenance is page/bbox-free here (these formats have no fixed pagination).
    """
    try:
        from markitdown import MarkItDown
    except ImportError as e:
        raise RuntimeError(
            "markitdown is not installed. `pip install 'markitdown[docx,pptx,pdf]'`."
        ) from e

    ext = os.path.splitext(file_path)[1].lower()
    md = MarkItDown()
    result = md.convert(file_path)
    text = getattr(result, "text_content", "") or ""

    return ParsedDocument(
        markdown=text,
        pages=[ParsedPage(page_num=1, markdown=text)],
        source_format=ext,
        parser="markitdown",
        used_ocr=False,
    )


def parse_html(html: str, base_url: str | None = None) -> str:
    """Convert a raw HTML string to markdown via markitdown (for url_agent).

    Falls back to returning the input unchanged if markitdown is unavailable, so
    URL ingestion still works (the caller can then strip tags itself).
    """
    try:
        from markitdown import MarkItDown
    except ImportError:
        logger.warning("markitdown unavailable; returning raw HTML for caller to strip")
        return html

    import io
    md = MarkItDown()
    stream = io.BytesIO(html.encode("utf-8"))
    try:
        # convert_stream needs a hint for the converter to pick HTML.
        result = md.convert_stream(stream, file_extension=".html")
        return getattr(result, "text_content", "") or ""
    except Exception as e:
        logger.warning("markitdown HTML conversion failed (%r); returning raw HTML", e)
        return html
