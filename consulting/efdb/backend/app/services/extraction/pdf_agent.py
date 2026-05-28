"""
PDF extraction agent.

Flow:
  1. scan_pdf()      → identifies tables/sections containing EF data
  2. extract_from_pdf() → extracts records from selected sections

Handles both text-based and scanned (image) PDFs.
Text pages: extracted with PyMuPDF (preserves layout).
Image pages: passed as base64 images to Claude Opus 4.6 (vision).
"""
import base64
import json
import math
from pathlib import Path
import fitz  # PyMuPDF
import anthropic
from app.config import settings
from app.schemas.ingestion import ScanResult, DocumentSection, ExtractedRecord, DocumentMetadata
from app.services.extraction.prompts import SCAN_SYSTEM_PROMPT, EXTRACT_SYSTEM_PROMPT, METADATA_EXTRACT_PROMPT, build_scan_user_message, build_extract_user_message

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

# Cost estimate: Claude Opus input ~$15/M tokens, output ~$75/M tokens
OPUS_INPUT_COST_PER_TOKEN = 15 / 1_000_000
OPUS_OUTPUT_COST_PER_TOKEN = 75 / 1_000_000
AVG_CHARS_PER_TOKEN = 4


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // AVG_CHARS_PER_TOKEN)


def _page_is_image(page: fitz.Page) -> bool:
    """Return True if the page contains no extractable text (likely scanned)."""
    text = page.get_text("text").strip()
    return len(text) < 50


def _extract_page_text(page: fitz.Page) -> str:
    """Extract text with layout preservation."""
    return page.get_text("text")


def _page_to_base64_image(page: fitz.Page, dpi: int = 150) -> str:
    """Render a page to a PNG image and return base64 encoded string."""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    return base64.standard_b64encode(img_bytes).decode()


def _build_document_content(doc: fitz.Document, selected_pages: list[int] | None = None) -> list[dict]:
    """
    Build the Claude message content for a PDF document.
    Returns a list of content blocks (text or image_url).
    """
    content = []
    pages = selected_pages if selected_pages else range(len(doc))

    for page_num in pages:
        page = doc[page_num]
        content.append({"type": "text", "text": f"\n--- Page {page_num + 1} ---\n"})
        if _page_is_image(page):
            img_b64 = _page_to_base64_image(page)
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": img_b64,
                },
            })
        else:
            page_text = _extract_page_text(page)
            content.append({"type": "text", "text": page_text})

    return content


async def scan_pdf(file_path: str, document_id: str, session_id: str) -> ScanResult:
    """
    Step 1: Scan a PDF and return a list of identified EF tables/sections.
    Uses Claude to identify which tables contain emission factor data.
    """
    doc = fitz.open(file_path)
    page_count = len(doc)
    has_scanned_pages = any(_page_is_image(doc[i]) for i in range(min(page_count, 10)))

    # For scan, we sample pages to keep cost low
    # If < 50 pages: scan all. If > 50: sample every 3rd page + first/last 5
    if page_count <= 50:
        sample_pages = list(range(page_count))
    else:
        step = max(1, page_count // 40)
        sample_pages = list(range(0, page_count, step))
        # Ensure first and last 5 pages are included
        for i in list(range(5)) + list(range(max(0, page_count - 5), page_count)):
            if i not in sample_pages:
                sample_pages.append(i)
        sample_pages = sorted(set(sample_pages))

    doc_content = _build_document_content(doc, sample_pages)
    doc.close()

    # Estimate tokens for cost estimate
    text_chars = sum(len(b.get("text", "")) for b in doc_content if b["type"] == "text")
    image_count = sum(1 for b in doc_content if b["type"] == "image")
    estimated_tokens = _estimate_tokens(str(text_chars)) + image_count * 1500  # ~1500 tokens per image

    estimated_cost = (
        estimated_tokens * OPUS_INPUT_COST_PER_TOKEN +
        500 * OPUS_OUTPUT_COST_PER_TOKEN  # output estimate for scan response
    )

    # Call Claude to identify tables
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        system=SCAN_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": doc_content + [{"type": "text", "text": build_scan_user_message()}],
        }],
    )

    sections = _parse_scan_response(response.content[0].text)

    # Extract document-level metadata from the first few pages of text
    first_page_text = " ".join(
        b.get("text", "") for b in doc_content[:6] if b["type"] == "text"
    )[:3000]
    document_metadata = await _extract_pdf_metadata(first_page_text)

    return ScanResult(
        session_id=session_id,
        document_id=document_id,
        sections_found=sections,
        estimated_tokens=estimated_tokens,
        estimated_cost_usd=round(estimated_cost, 4),
        page_count=page_count,
        has_scanned_pages=has_scanned_pages,
        document_metadata=document_metadata,
    )


async def _extract_pdf_metadata(text_sample: str) -> DocumentMetadata:
    """Extract document-level metadata from the first pages of a PDF."""
    if not text_sample.strip():
        return DocumentMetadata()
    try:
        response = await client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=METADATA_EXTRACT_PROMPT,
            messages=[{"role": "user", "content": f"DOCUMENT TEXT (first pages):\n{text_sample}"}],
        )
        raw = response.content[0].text
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            return DocumentMetadata(**{k: v for k, v in data.items() if v is not None})
    except Exception:
        pass
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


async def extract_from_pdf(file_path: str, section_indices: list[int], confirmed_metadata: DocumentMetadata | None = None) -> list[ExtractedRecord]:
    """
    Step 2: Extract emission factor records from selected sections of a PDF.
    confirmed_metadata is prepended as hard context so Claude applies it to every record.
    """
    doc = fitz.open(file_path)
    doc_content = _build_document_content(doc)
    doc.close()

    # Build confirmed metadata block (source-schema field names).
    meta_lines = _confirmed_metadata_lines(confirmed_metadata)

    meta_prefix = []
    if meta_lines:
        meta_prefix = [{"type": "text", "text":
            "CONFIRMED DOCUMENT METADATA (apply ALL of these to every extracted record):\n"
            + "\n".join(meta_lines) + "\n\n"
        }]

    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=16000,
        system=EXTRACT_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": meta_prefix + doc_content + [{
                "type": "text",
                "text": build_extract_user_message(section_indices),
            }],
        }],
    )

    return _parse_extraction_response(response.content[0].text)


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
    return lines
