"""
URL ingestion agent.
Fetches a URL. If it resolves to a PDF, delegates to pdf_agent.
If it's an HTML page, extracts EF data directly from the page content.
"""
import json
import tempfile
import os
import httpx
import anthropic
from app.config import settings
from app.schemas.ingestion import ScanResult, DocumentSection, ExtractedRecord, DocumentMetadata
from app.services.extraction.prompts import SCAN_SYSTEM_PROMPT, EXTRACT_SYSTEM_PROMPT, METADATA_EXTRACT_PROMPT, build_scan_user_message, build_extract_user_message

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

SONNET_INPUT_COST_PER_TOKEN = 3 / 1_000_000
SONNET_OUTPUT_COST_PER_TOKEN = 15 / 1_000_000


async def _extract_url_metadata(page_text: str, url: str) -> DocumentMetadata:
    """Extract document-level metadata from a URL's page text."""
    sample = page_text[:3000]
    if not sample.strip():
        return DocumentMetadata()
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=METADATA_EXTRACT_PROMPT,
            messages=[{"role": "user", "content": f"URL: {url}\n\nDOCUMENT TEXT (first portion):\n{sample}"}],
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


async def fetch_and_scan_url(url: str, document_id: str, session_id: str) -> ScanResult:
    """Fetch a URL and scan it for EF data."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as http:
        response = await http.get(url)

    content_type = response.headers.get("content-type", "")

    if "pdf" in content_type or url.lower().endswith(".pdf"):
        # Save to temp file and use PDF agent
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name
        try:
            from app.services.extraction.pdf_agent import scan_pdf
            result = await scan_pdf(tmp_path, document_id, session_id)
            return result
        finally:
            pass  # Keep file for extraction step

    # HTML page — extract text content
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        page_text = soup.get_text(separator="\n", strip=True)
    except Exception:
        page_text = response.text[:50000]

    estimated_tokens = len(page_text) // 4
    estimated_cost = (
        estimated_tokens * SONNET_INPUT_COST_PER_TOKEN +
        500 * SONNET_OUTPUT_COST_PER_TOKEN
    )

    # Ask Claude to identify EF sections
    response_ai = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        system=SCAN_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"URL: {url}\n\n{page_text[:40000]}\n\n{build_scan_user_message()}"}],
    )

    from app.services.extraction.pdf_agent import _parse_scan_response
    sections = _parse_scan_response(response_ai.content[0].text)

    # Extract document-level metadata
    document_metadata = await _extract_url_metadata(page_text, url)

    return ScanResult(
        session_id=session_id,
        document_id=document_id,
        sections_found=sections,
        estimated_tokens=estimated_tokens,
        estimated_cost_usd=round(estimated_cost, 4),
        page_count=1,
        has_scanned_pages=False,
        document_metadata=document_metadata,
    )


async def extract_from_url(url: str, section_indices: list[int], confirmed_metadata: DocumentMetadata | None = None) -> list[ExtractedRecord]:
    """Extract EF records from a URL."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as http:
        response = await http.get(url)

    content_type = response.headers.get("content-type", "")

    if "pdf" in content_type or url.lower().endswith(".pdf"):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name
        try:
            from app.services.extraction.pdf_agent import extract_from_pdf
            return await extract_from_pdf(tmp_path, section_indices, confirmed_metadata)
        finally:
            os.unlink(tmp_path)

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        page_text = soup.get_text(separator="\n", strip=True)
    except Exception:
        page_text = response.text[:50000]

    # Build confirmed metadata block (source-schema field names).
    from app.services.extraction.pdf_agent import _confirmed_metadata_lines
    meta_lines = _confirmed_metadata_lines(confirmed_metadata)

    meta_prefix = ""
    if meta_lines:
        meta_prefix = (
            "CONFIRMED DOCUMENT METADATA (apply ALL of these to every extracted record):\n"
            + "\n".join(meta_lines) + "\n\n"
        )

    user_content = f"URL: {url}\n\n{meta_prefix}{page_text[:40000]}\n\n{build_extract_user_message(section_indices)}"

    response_ai = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        system=EXTRACT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    from app.services.extraction.pdf_agent import _parse_extraction_response
    return _parse_extraction_response(response_ai.content[0].text)
