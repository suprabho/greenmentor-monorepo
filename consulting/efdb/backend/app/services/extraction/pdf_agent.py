"""
Document extraction agent (PDFs, images, and office/html files).

Flow:
  1. scan_document() / scan_pdf()       → identifies tables/sections with EF data
  2. extract_from_document() / extract_from_pdf() → extracts records from sections

Text is normalized to markdown by document_parser:
  - liteparse  for PDFs/images (local Tesseract OCR, spatial markdown, bboxes)
  - markitdown for docx/pptx/odt/rtf/html
Pages liteparse can't read (no embedded text AND OCR produced nothing) fall back
to Claude vision via liteparse screenshots. Bounding boxes from liteparse are
matched back onto each extracted field for provenance.

`scan_pdf` / `extract_from_pdf` are kept as names for backward-compatible imports;
they are aliases of the format-agnostic scan_document / extract_from_document.
"""
import base64
import json
import logging
import time
import anthropic
from app.config import settings
from app.schemas.ingestion import (
    ScanResult, DocumentSection, ExtractedRecord, DocumentMetadata, ExtractionFieldResult,
)
from app.services.extraction.document_parser import (
    ParsedDocument, parse_document, liteparse_screenshots,
)
from app.services.extraction.prompts import (
    scan_system_prompt, extract_system_prompt, metadata_extract_prompt,
    build_scan_user_message, build_extract_user_message,
)

logger = logging.getLogger("efdb.extraction.pdf")

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

# Cost estimate: Claude Opus input ~$15/M tokens, output ~$75/M tokens
OPUS_INPUT_COST_PER_TOKEN = 15 / 1_000_000
OPUS_OUTPUT_COST_PER_TOKEN = 75 / 1_000_000
AVG_CHARS_PER_TOKEN = 4

# A page whose normalized markdown is shorter than this is treated as unreadable
# (scanned with failed OCR, or image-only) and handed to Claude vision instead.
MIN_PAGE_TEXT_CHARS = 40


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // AVG_CHARS_PER_TOKEN)


def _build_document_content(parsed: ParsedDocument, file_path: str,
                            selected_pages: list[int] | None = None) -> list[dict]:
    """
    Build the Claude message content from a ParsedDocument.

    Two modes:
      - whole document (selected_pages=None): lead with the document-level
        markdown, which carries the best table/heading reconstruction. Used for
        extraction and small-document scans.
      - sampled pages (selected_pages set): emit per-page text blocks for just
        the sampled 1-based page numbers, to cap tokens on large-document scans.

    Either way, any page whose text came back essentially empty (OCR produced
    nothing) is rendered to a PNG and sent as a Claude-vision image block.
    """
    all_nums = [p.page_num for p in parsed.pages]
    considered = selected_pages if selected_pages else all_nums

    # Pages we genuinely couldn't read get the (more expensive) vision fallback —
    # render just those, and only when liteparse can screenshot them.
    need_vision = [n for n in considered
                   if len(parsed.page_markdown(n).strip()) < MIN_PAGE_TEXT_CHARS]
    shots: dict[int, bytes] = {}
    if need_vision and parsed.parser == "liteparse":
        shots = liteparse_screenshots(file_path, need_vision)

    def _vision_block(page_num: int) -> dict:
        img_b64 = base64.standard_b64encode(shots[page_num]).decode()
        return {"type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": img_b64}}

    content: list[dict] = []

    if not selected_pages:
        # Whole-document mode: doc-level markdown first (best tables), then any
        # vision images for pages OCR couldn't read.
        if parsed.markdown.strip():
            content.append({"type": "text", "text": parsed.markdown})
        for page_num in need_vision:
            if page_num in shots:
                content.append({"type": "text", "text": f"\n--- Page {page_num} (image) ---\n"})
                content.append(_vision_block(page_num))
        return content

    # Sampled-pages mode: per-page text (or vision fallback) for the sample.
    for page_num in selected_pages:
        content.append({"type": "text", "text": f"\n--- Page {page_num} ---\n"})
        md = parsed.page_markdown(page_num).strip()
        if len(md) >= MIN_PAGE_TEXT_CHARS:
            content.append({"type": "text", "text": md})
        elif page_num in shots:
            content.append(_vision_block(page_num))
        elif md:
            content.append({"type": "text", "text": md})  # short but non-empty

    return content


def _attach_provenance(records: list[ExtractedRecord], parsed: ParsedDocument) -> list[ExtractedRecord]:
    """Match each extracted field's source_snippet back to a liteparse block to
    set source_page / source_bbox. Best-effort: markitdown docs (no coords) and
    unmatched snippets are left without provenance."""
    if parsed.parser != "liteparse":
        return records
    blocks = [(b.text.lower(), b.page, b.bbox)
              for p in parsed.pages for b in p.blocks if b.bbox]
    if not blocks:
        return records

    for rec in records:
        for fname in type(rec).model_fields:
            val = getattr(rec, fname, None)
            if not isinstance(val, ExtractionFieldResult):
                continue
            if not val.source_snippet or val.source_page is not None:
                continue
            snip = val.source_snippet.strip().lower()
            if len(snip) < 2:
                continue
            for text, page, bbox in blocks:
                # snippet inside a block, or a short block inside the snippet
                if snip in text or (len(text) > 3 and text in snip):
                    val.source_page = page
                    val.source_bbox = bbox
                    break
    return records


async def scan_document(file_path: str, document_id: str, session_id: str, document_type: str = "generic") -> ScanResult:
    """
    Step 1: Scan a document and return a list of identified EF tables/sections.
    Uses Claude to identify which tables contain emission factor data.
    document_type="epd" switches to EPD-aware (EN 15804 / ISO 14025) prompts.
    """
    parsed = parse_document(file_path)
    page_count = parsed.page_count
    has_scanned_pages = parsed.used_ocr

    # For scan, the local parse already covered the whole doc cheaply. Small
    # docs (<=50 pages) go to Claude as one document-level markdown blob (best
    # tables); large docs are sampled per-page (~40 evenly + first/last 5) to
    # cap Claude tokens.
    all_page_nums = [p.page_num for p in parsed.pages]
    if page_count <= 50:
        doc_content = _build_document_content(parsed, file_path)
        sampled_count = page_count
    else:
        step = max(1, page_count // 40)
        sampled = set(all_page_nums[::step])
        sampled.update(all_page_nums[:5])
        sampled.update(all_page_nums[-5:])
        sample_pages = sorted(sampled)
        doc_content = _build_document_content(parsed, file_path, sample_pages)
        sampled_count = len(sample_pages)

    # Estimate tokens for cost estimate
    text_chars = sum(len(b.get("text", "")) for b in doc_content if b["type"] == "text")
    image_count = sum(1 for b in doc_content if b["type"] == "image")
    estimated_tokens = _estimate_tokens(str(text_chars)) + image_count * 1500  # ~1500 tokens per image

    estimated_cost = (
        estimated_tokens * OPUS_INPUT_COST_PER_TOKEN +
        500 * OPUS_OUTPUT_COST_PER_TOKEN  # output estimate for scan response
    )

    # Call Claude to identify tables
    logger.info("scan: %d pages (%d sampled, %d via vision fallback) parser=%s, ~%d tokens",
                page_count, sampled_count, image_count, parsed.parser, estimated_tokens)
    t0 = time.monotonic()
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        system=scan_system_prompt(document_type),
        messages=[{
            "role": "user",
            "content": doc_content + [{"type": "text", "text": build_scan_user_message()}],
        }],
    )

    sections = _parse_scan_response(response.content[0].text)
    logger.info("scan: Claude returned %d section(s) in %.1fs", len(sections), time.monotonic() - t0)

    # Extract document-level metadata from the first few pages of text
    first_page_text = " ".join(
        b.get("text", "") for b in doc_content[:6] if b["type"] == "text"
    )[:3000]
    document_metadata = await _extract_pdf_metadata(first_page_text, document_type)

    return ScanResult(
        session_id=session_id,
        document_id=document_id,
        sections_found=sections,
        estimated_tokens=estimated_tokens,
        estimated_cost_usd=round(estimated_cost, 4),
        page_count=page_count,
        has_scanned_pages=has_scanned_pages,
        document_metadata=document_metadata,
        document_type=document_type,
    )


# Backward-compatible alias (router and url_agent import scan_pdf).
scan_pdf = scan_document


async def _extract_pdf_metadata(text_sample: str, document_type: str = "generic") -> DocumentMetadata:
    """Extract document-level metadata from the first pages of a PDF."""
    if not text_sample.strip():
        return DocumentMetadata()
    try:
        response = await client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=metadata_extract_prompt(document_type),
            messages=[{"role": "user", "content": f"DOCUMENT TEXT (first pages):\n{text_sample}"}],
        )
        raw = response.content[0].text
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            return DocumentMetadata(**{k: v for k, v in data.items() if v is not None})
    except Exception as e:
        logger.warning("metadata extraction failed (continuing without): %r", e)
    return DocumentMetadata()


def _parse_scan_response(response_text: str) -> list[DocumentSection]:
    """Parse Claude's scan response into DocumentSection objects."""
    try:
        # Claude is instructed to return JSON
        start = response_text.find("[")
        end = response_text.rfind("]") + 1
        if start >= 0 and end > start:
            data = json.loads(response_text[start:end])
            sections = []
            for i, item in enumerate(data):
                sections.append(DocumentSection(
                    index=i,
                    title=item.get("title", f"Table {i + 1}"),
                    page_range=item.get("page_range", ""),
                    column_headers=item.get("column_headers", []),
                    description=item.get("description", ""),
                    row_count_estimate=item.get("row_count_estimate", 0),
                ))
            return sections
    except (json.JSONDecodeError, KeyError, TypeError):
        pass
    # Fallback: return a single catch-all section
    return [DocumentSection(
        index=0,
        title="Full document",
        page_range=f"1-all",
        column_headers=[],
        description="Could not identify specific tables — extract from entire document",
        row_count_estimate=0,
    )]


async def extract_from_document(file_path: str, section_indices: list[int], confirmed_metadata: DocumentMetadata | None = None, document_type: str = "generic") -> list[ExtractedRecord]:
    """
    Step 2: Extract emission factor records from selected sections of a document.
    confirmed_metadata is prepended as hard context so Claude applies it to every record.
    document_type="epd" switches to the EPD-specific extraction prompt.
    Handles PDFs/images (liteparse) and office/html files (markitdown).
    """
    parsed = parse_document(file_path)
    doc_content = _build_document_content(parsed, file_path)

    # Build confirmed metadata block (source-schema field names).
    meta_lines = _confirmed_metadata_lines(confirmed_metadata)

    meta_prefix = []
    if meta_lines:
        meta_prefix = [{"type": "text", "text":
            "CONFIRMED DOCUMENT METADATA (apply ALL of these to every extracted record):\n"
            + "\n".join(meta_lines) + "\n\n"
        }]

    logger.info("extract: sections=%s, %d content block(s), parser=%s",
                section_indices, len(doc_content), parsed.parser)
    t0 = time.monotonic()
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=16000,
        system=extract_system_prompt(document_type),
        messages=[{
            "role": "user",
            "content": meta_prefix + doc_content + [{
                "type": "text",
                "text": build_extract_user_message(section_indices, document_type),
            }],
        }],
    )

    records = _parse_extraction_response(response.content[0].text)
    # Attach page/bbox provenance from liteparse blocks (best-effort).
    records = _attach_provenance(records, parsed)
    logger.info("extract: %d record(s) parsed in %.1fs (stop_reason=%s)",
                len(records), time.monotonic() - t0, response.stop_reason)
    return records


# Backward-compatible alias (router and url_agent import extract_from_pdf).
extract_from_pdf = extract_from_document


def _parse_extraction_response(response_text: str) -> list[ExtractedRecord]:
    """Parse Claude's extraction response into a list of ExtractedRecord objects."""
    try:
        start = response_text.find("[")
        end = response_text.rfind("]") + 1
        if start >= 0 and end > start:
            data = json.loads(response_text[start:end])
            records = []
            for i, item in enumerate(data):
                record = _dict_to_extracted_record(item, i)
                records.append(record)
            return records
        # No JSON array found at all
        return []
    except json.JSONDecodeError as e:
        # Response was likely truncated — give a clear message
        if end <= start:
            raise ValueError(
                f"Claude returned no JSON array. Raw response start:\n{response_text[:300]}"
            )
        raise ValueError(
            f"Failed to parse extraction response (possible output truncation): {e}\n\n"
            f"Raw (first 400 chars):\n{response_text[:400]}"
        )
    except (KeyError, TypeError) as e:
        raise ValueError(f"Failed to map extracted fields: {e}\n\nRaw:\n{response_text[:400]}")


def _dict_to_extracted_record(item: dict, index: int) -> ExtractedRecord:
    """Convert a raw extraction dict from Claude into an ExtractedRecord."""
    from app.schemas.ingestion import ExtractionFieldResult

    def field(key: str) -> ExtractionFieldResult:
        entry = item.get(key, {})
        if isinstance(entry, dict):
            return ExtractionFieldResult(
                value=entry.get("value"),
                source_snippet=entry.get("source_snippet"),
                extraction_confidence=entry.get("extraction_confidence", "high"),
                extraction_note=entry.get("extraction_note"),
            )
        return ExtractionFieldResult(value=entry)

    has_outlier = item.get("has_outlier_values", False)
    has_unit_mismatch = item.get("has_unit_mismatch", False)
    outlier_notes = item.get("outlier_notes", [])

    return _record_from_dict(item, index, field, has_outlier, has_unit_mismatch, outlier_notes)


def _record_from_dict(item, index, field, has_outlier, has_unit_mismatch, outlier_notes):
    """Build ExtractedRecord from a source-schema dict produced by Claude."""
    kwargs = {"index": index}
    SOURCE_FIELDS = [
        "ef_id", "activity_name", "activity_description", "activity_code",
        "emission_category", "sub_category", "ghg_scope", "scope3_category", "activity_level",
        "ef_value", "ghg_species", "expressed_as_co2e", "gwp_basis", "gwp_value_used", "ef_type",
        "numerator_unit", "denominator_unit", "denominator_basis", "unit_notes",
        "geography_type", "country_iso", "region_name", "grid_zone_id", "location_basis",
        "fuel_material_type", "technology_descriptor", "vehicle_type", "end_use_sector",
        "combustion_type", "carbon_content_fraction",
        "reference_year", "valid_from", "valid_to", "ef_version", "update_frequency",
        "source_organization", "source_database", "publication_title", "publication_year",
        "source_url", "original_ef_value", "original_unit", "data_origin",
        "calculation_method", "system_boundary", "includes_biogenic_co2",
        "includes_land_use_change", "allocation_method", "upstream_included",
        "uncertainty_pct", "uncertainty_method", "dq_score_overall",
        "dq_geographic_rep", "dq_temporal_rep", "dq_tech_rep", "third_party_verified",
        "status", "framework_tags", "sector_tags", "is_default_ef", "notes",
        "source_type", "supplier_name", "supplier_country", "supplier_sector",
        "supplier_epd_reference",
    ]
    for key in SOURCE_FIELDS:
        if key in item:
            kwargs[key] = field(key)
    kwargs["has_outlier_values"] = has_outlier
    kwargs["has_unit_mismatch"] = has_unit_mismatch
    kwargs["outlier_notes"] = outlier_notes
    return ExtractedRecord(**kwargs)


def _confirmed_metadata_lines(m: "DocumentMetadata | None") -> list[str]:
    """Build the 'CONFIRMED DOCUMENT METADATA' block prepended to every extraction."""
    if not m:
        return []
    lines = []
    if m.source_organization:   lines.append(f"source_organization: {m.source_organization}")
    if m.source_database:       lines.append(f"source_database: {m.source_database}")
    if m.publication_title:     lines.append(f"publication_title: {m.publication_title}")
    if m.publication_year:      lines.append(f"publication_year: {m.publication_year}")
    if m.reference_year:        lines.append(f"reference_year: {m.reference_year}")
    if m.valid_from:            lines.append(f"valid_from: {m.valid_from}")
    if m.valid_to:              lines.append(f"valid_to: {m.valid_to}")
    if m.country_iso:           lines.append(f"country_iso (ISO3): {m.country_iso} ({m.geography_description or ''})")
    if m.geography_type:        lines.append(f"geography_type: {m.geography_type}")
    if m.gwp_basis:             lines.append(f"gwp_basis: {m.gwp_basis}")
    if m.ghg_scope:             lines.append(f"ghg_scope: {m.ghg_scope}")
    if m.system_boundary:       lines.append(f"system_boundary: {m.system_boundary}")
    if m.data_origin:           lines.append(f"data_origin: {m.data_origin}")
    if m.calculation_method:    lines.append(f"calculation_method: {m.calculation_method}")
    if m.notes:                 lines.append(f"notes (apply to every record): {m.notes}")
    if m.guidance_notes:        lines.append(f"Guidance: {m.guidance_notes}")
    # EPD-specific context (set when document_type == "epd")
    if m.manufacturer:              lines.append(f"manufacturer (→ supplier_name AND source_organization): {m.manufacturer}")
    if m.epd_registration_number:   lines.append(f"EPD registration number (→ supplier_epd_reference): {m.epd_registration_number}")
    if m.programme_operator:        lines.append(f"programme operator (→ source_database): {m.programme_operator}")
    if m.pcr_reference:             lines.append(f"PCR reference (mention in notes): {m.pcr_reference}")
    if m.declared_unit:             lines.append(f"declared/functional unit (→ denominator_basis; derive denominator_unit from it): {m.declared_unit}")
    return lines
