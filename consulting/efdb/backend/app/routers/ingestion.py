import logging
import time
import uuid
import os
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_db
from app.models.source_document import SourceDocument
from app.models.extraction_session import ExtractionSession, SessionStatus, RejectedExtraction
from app.models.emission_factor import EmissionFactor
from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User
from app.routers.auth import get_current_user, require_admin
from app.schemas.ingestion import (
    ScanResult, SectionSelection, SessionStatusOut, ReviewAction, BulkReviewAction, ReviewSummary,
    ParsedDocOut,
)
from app.services.extraction.pdf_agent import scan_document, extract_from_document
from app.services.extraction.excel_agent import scan_excel, extract_from_excel
from app.services.extraction.url_agent import fetch_and_scan_url, extract_from_url
from app.services.extraction.document_parser import route_for, parse_document
from app.services.confidence_score import calculate_confidence
from app.services.conflict_detection import detect_and_flag_conflicts
from app.services.embeddings import generate_embedding
from app.config import settings
import httpx

router = APIRouter(prefix="/ingestion", tags=["ingestion"])
logger = logging.getLogger("efdb.ingestion")


async def _save_upload(file: UploadFile, user_id: str) -> tuple[str, str]:
    """Save uploaded file to disk, return (file_path, mime_type)."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "upload")[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.upload_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return file_path, file.content_type or "application/octet-stream"


def _is_spreadsheet(path: str | None, mime: str | None) -> bool:
    """Spreadsheets go to excel_agent (its merged-cell pipeline beats markdown)."""
    if path and path.lower().endswith((".xlsx", ".xls", ".csv")):
        return True
    return bool(mime and ("excel" in mime or "spreadsheet" in mime))


# ── Generic parse (document → markdown, no extraction) ──────────────────────

@router.post("/parse", response_model=ParsedDocOut)
async def parse_only(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Normalize an uploaded document to markdown via the unified liteparse/
    markitdown layer and return it — no DB writes, no EF scan/extract.

    Reused by external services (e.g. the ESG-Agents app) that just need the
    document as markdown to hand to their own LLM extraction. Spreadsheets are
    not supported here (excel_agent owns them); they return 415.
    """
    if file.size and file.size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_size_mb}MB limit")

    file_path, mime_type = await _save_upload(file, str(current_user.id))
    try:
        if _is_spreadsheet(file_path, mime_type):
            raise HTTPException(
                415, "Spreadsheets are not supported by /parse — use the Excel ingestion path."
            )
        try:
            route_for(file_path)  # raises ValueError on unsupported extension
        except ValueError:
            raise HTTPException(
                415,
                "Unsupported file type. Upload a PDF, Word, PowerPoint, "
                "OpenDocument, RTF, HTML, or image file.",
            )
        t0 = time.monotonic()
        parsed = parse_document(file_path, mime_type)
        logger.info("parse done: %r (%s, %d page(s), ocr=%s) %.1fs by %s",
                    file.filename, parsed.parser, parsed.page_count, parsed.used_ocr,
                    time.monotonic() - t0, current_user.email)
        return ParsedDocOut(
            markdown=parsed.markdown,
            page_count=parsed.page_count,
            parser=parsed.parser,
            used_ocr=parsed.used_ocr,
            source_format=parsed.source_format,
        )
    finally:
        try:
            os.remove(file_path)
        except OSError:
            pass


# ── Step 1: Upload and scan ────────────────────────────────────────────────

@router.post("/upload/scan", response_model=ScanResult)
async def upload_and_scan(
    file: UploadFile = File(...),
    document_type: str = Form("generic"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload a PDF or Excel and return the list of tables/sections found.

    document_type: "generic" (default) or "epd" — EPDs use EN 15804 / ISO 14025
    aware extraction prompts (declared unit, lifecycle modules, GWP indicators).
    """
    if file.size and file.size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_size_mb}MB limit")
    if document_type not in ("generic", "epd"):
        raise HTTPException(422, "document_type must be 'generic' or 'epd'")

    file_path, mime_type = await _save_upload(file, str(current_user.id))
    file_size = os.path.getsize(file_path)
    logger.info("upload received: %r (%s, %.1f KB, type=%s) by %s",
                file.filename, mime_type, file_size / 1024, document_type, current_user.email)

    doc = SourceDocument(
        original_filename=file.filename,
        file_path=file_path,
        mime_type=mime_type,
        file_size_bytes=file_size,
        uploaded_by=current_user.id,
        document_type=document_type,
    )
    db.add(doc)
    await db.flush()

    session = ExtractionSession(
        source_document_id=doc.id,
        created_by=current_user.id,
        status=SessionStatus.extracting,
    )
    db.add(session)
    await db.commit()
    await db.refresh(doc)
    await db.refresh(session)

    # Scan the document to find EF tables/sections. Spreadsheets use excel_agent;
    # PDFs/images/office/html go through the unified document agent.
    t0 = time.monotonic()
    if _is_spreadsheet(file_path, mime_type):
        scan_result = await scan_excel(file_path, str(doc.id), str(session.id), document_type)
    else:
        try:
            route_for(file_path)  # raises ValueError on unsupported extension
        except ValueError:
            raise HTTPException(
                415,
                "Unsupported file type. Upload a PDF, Excel/CSV, Word, PowerPoint, "
                "OpenDocument, RTF, HTML, or image file.",
            )
        scan_result = await scan_document(file_path, str(doc.id), str(session.id), document_type)
    logger.info("scan done: session=%s %d section(s), ~%d tokens ($%.4f est), %.1fs",
                session.id, len(scan_result.sections_found), scan_result.estimated_tokens,
                scan_result.estimated_cost_usd, time.monotonic() - t0)

    # Update document with cost estimate
    doc.estimated_tokens = scan_result.estimated_tokens
    doc.estimated_cost_usd = scan_result.estimated_cost_usd
    session.status = SessionStatus.awaiting_review
    await db.commit()

    return scan_result


@router.post("/url/scan", response_model=ScanResult)
async def url_scan(
    url: str = Form(...),
    document_type: str = Form("generic"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Fetch a URL and scan it for EF tables."""
    if document_type not in ("generic", "epd"):
        raise HTTPException(422, "document_type must be 'generic' or 'epd'")
    doc = SourceDocument(
        source_url=url,
        uploaded_by=current_user.id,
        document_type=document_type,
    )
    db.add(doc)
    await db.flush()
    session = ExtractionSession(
        source_document_id=doc.id,
        created_by=current_user.id,
        status=SessionStatus.extracting,
    )
    db.add(session)
    await db.commit()
    await db.refresh(doc)
    await db.refresh(session)

    logger.info("url scan: %s (type=%s) by %s", url, document_type, current_user.email)
    scan_result = await fetch_and_scan_url(url, str(doc.id), str(session.id), document_type)
    logger.info("scan done: session=%s %d section(s), ~%d tokens ($%.4f est)",
                session.id, len(scan_result.sections_found), scan_result.estimated_tokens,
                scan_result.estimated_cost_usd)
    doc.estimated_tokens = scan_result.estimated_tokens
    doc.estimated_cost_usd = scan_result.estimated_cost_usd
    session.status = SessionStatus.awaiting_review
    await db.commit()
    return scan_result


# ── Step 2: Confirm extraction ─────────────────────────────────────────────

@router.post("/sessions/{session_id}/extract")
async def start_extraction(
    session_id: uuid.UUID,
    selection: SectionSelection,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """User confirms which sections to extract. Kicks off extraction job."""
    session = await _get_session(session_id, db)
    doc = (await db.execute(select(SourceDocument).where(SourceDocument.id == session.source_document_id))).scalar_one()

    session.selected_sections = selection.section_indices
    session.status = SessionStatus.extracting
    await db.commit()

    background_tasks.add_task(_run_extraction, session_id, doc, selection.section_indices, selection.confirmed_metadata)
    return {"session_id": str(session_id), "status": "extracting"}


async def _run_extraction(session_id: uuid.UUID, doc: SourceDocument, sections: list[int], confirmed_metadata=None):
    """Background task: run the full extraction and store result on the session."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        session = await _get_session(session_id, db)
        document_type = doc.document_type or "generic"
        logger.info("extraction started: session=%s doc=%s sections=%s type=%s",
                    session_id, doc.id, sections, document_type)
        t0 = time.monotonic()
        try:
            if doc.file_path:
                if _is_spreadsheet(doc.file_path, doc.mime_type):
                    records = await extract_from_excel(doc.file_path, sections, confirmed_metadata, document_type)
                else:
                    records = await extract_from_document(doc.file_path, sections, confirmed_metadata, document_type)
            else:
                records = await extract_from_url(doc.source_url, sections, confirmed_metadata, document_type)

            session.extraction_result = [r.model_dump(mode="json") for r in records]
            session.total_extracted = len(records)
            session.review_progress = {"approved": [], "rejected": [], "pending": list(range(len(records)))}
            session.status = SessionStatus.in_review
            logger.info("extraction done: session=%s %d record(s) in %.1fs",
                        session_id, len(records), time.monotonic() - t0)
        except Exception as e:
            session.status = SessionStatus.failed
            session.error_message = str(e)
            logger.exception("extraction failed: session=%s after %.1fs",
                             session_id, time.monotonic() - t0)
        await db.commit()


# ── Step 3: Review ─────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}", response_model=SessionStatusOut)
async def get_session_status(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await _get_session(session_id, db)


@router.get("/sessions/{session_id}/records")
async def get_session_records(
    session_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return paginated extracted records for review."""
    session = await _get_session(session_id, db)
    if not session.extraction_result:
        return {"records": [], "total": 0}
    records = session.extraction_result
    total = len(records)
    start = (page - 1) * page_size
    return {"records": records[start:start + page_size], "total": total, "page": page, "page_size": page_size}


@router.post("/sessions/{session_id}/review/bulk")
async def bulk_review(
    session_id: uuid.UUID,
    action: BulkReviewAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Approve or reject all (or a specified range of) pending records."""
    session = await _get_session(session_id, db)
    progress = session.review_progress or {"approved": [], "rejected": [], "pending": []}
    targets = action.indices if action.indices is not None else list(range(session.total_extracted or 0))

    for idx in targets:
        if action.action == "approve_all":
            if idx not in progress["approved"]:
                progress["approved"].append(idx)
            if idx in progress["rejected"]:
                progress["rejected"].remove(idx)
            if idx in progress["pending"]:
                progress["pending"].remove(idx)
        elif action.action == "reject_all":
            if idx not in progress["rejected"]:
                progress["rejected"].append(idx)
            if idx in progress["approved"]:
                progress["approved"].remove(idx)
            if idx in progress["pending"]:
                progress["pending"].remove(idx)

    session.review_progress = progress
    flag_modified(session, "review_progress")
    session.total_approved = len(progress["approved"])
    session.total_rejected = len(progress["rejected"])
    await db.commit()
    return {"status": "ok", "progress": progress}


@router.post("/sessions/{session_id}/review/{record_index}")
async def review_record(
    session_id: uuid.UUID,
    record_index: int,
    action: ReviewAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Approve or reject a single record in the review step."""
    session = await _get_session(session_id, db)
    if not session.extraction_result or record_index >= len(session.extraction_result):
        raise HTTPException(400, "Invalid record index")

    progress = session.review_progress or {"approved": [], "rejected": [], "pending": []}

    if action.action == "approve":
        if record_index not in progress["approved"]:
            progress["approved"].append(record_index)
        if record_index in progress["rejected"]:
            progress["rejected"].remove(record_index)
        if record_index in progress["pending"]:
            progress["pending"].remove(record_index)
        if action.edited_data:
            session.extraction_result[record_index].update(action.edited_data)
    elif action.action == "reject":
        if record_index not in progress["rejected"]:
            progress["rejected"].append(record_index)
        if record_index in progress["approved"]:
            progress["approved"].remove(record_index)
        if record_index in progress["pending"]:
            progress["pending"].remove(record_index)
    elif action.action == "pending":
        if record_index in progress["approved"]:
            progress["approved"].remove(record_index)
        if record_index in progress["rejected"]:
            progress["rejected"].remove(record_index)
        if record_index not in progress["pending"]:
            progress["pending"].append(record_index)

    session.review_progress = progress
    flag_modified(session, "review_progress")
    session.total_approved = len(progress["approved"])
    session.total_rejected = len(progress["rejected"])
    await db.commit()
    return {"status": "ok", "progress": progress}


# ── Step 4: Commit approved records ────────────────────────────────────────

@router.post("/sessions/{session_id}/commit", response_model=ReviewSummary)
async def commit_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Commit all approved records to the database. Reject the rest."""
    session = await _get_session(session_id, db)
    if session.status != SessionStatus.in_review:
        raise HTTPException(400, f"Session is not in review state (current: {session.status})")

    from app.models.confidence_config import ConfidenceWeightConfig
    config_result = await db.execute(select(ConfidenceWeightConfig).where(ConfidenceWeightConfig.is_active == True))
    config = config_result.scalar_one_or_none()
    weights = config.weights if config else ConfidenceWeightConfig.default_weights()

    progress = session.review_progress or {}
    approved_indices = progress.get("approved", [])
    rejected_indices = progress.get("rejected", [])
    committed_ids = []
    conflicts_flagged = 0

    for idx in approved_indices:
        raw = session.extraction_result[idx]
        ef = _build_ef_from_extraction(raw, session, current_user.id)
        # `calculate_confidence` is kept as a back-compat shim that reads
        # the dq_score_overall pedigree score; we don't store its output
        # since the source schema already has dq_* columns.
        calculate_confidence(ef, weights)
        ef.name_embedding = await generate_embedding(ef.activity_name)
        db.add(ef)
        await db.flush()

        conflict_count = await detect_and_flag_conflicts(ef, db)
        if conflict_count > 0:
            conflicts_flagged += 1

        db.add(AuditLog(
            action=AuditAction.record_approved,
            actor_id=current_user.id,
            emission_factor_id=ef.id,
            extraction_session_id=session.id,
            details={"record_index": idx},
        ))
        committed_ids.append(ef.id)

    # Archive rejected records
    for idx in rejected_indices:
        raw = session.extraction_result[idx]
        db.add(RejectedExtraction(
            session_id=session.id,
            rejected_by=current_user.id,
            extracted_data=raw,
        ))

    session.status = SessionStatus.completed
    session.completed_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("commit done: session=%s approved=%d rejected=%d conflicts=%d by %s",
                session_id, len(approved_indices), len(rejected_indices),
                conflicts_flagged, current_user.email)

    return ReviewSummary(
        approved=len(approved_indices),
        rejected=len(rejected_indices),
        conflicts_flagged=conflicts_flagged,
        records_committed=committed_ids,
    )


def _build_ef_from_extraction(raw: dict, session: ExtractionSession, user_id: uuid.UUID) -> EmissionFactor:
    """Convert a raw extraction dict (as stored in session) to an EmissionFactor model instance.

    Expects Claude to emit dicts whose keys match the source-schema column
    names. Values can be either scalars or {value, confidence, source} dicts
    (the older ExtractionFieldResult shape). _v() handles both.
    """
    def v(field: str, default=None):
        entry = raw.get(field, None)
        if entry is None:
            return default
        if isinstance(entry, dict) and "value" in entry:
            return entry.get("value")
        return entry

    def vbool(field: str, default=None):
        x = v(field, default)
        if x is None or isinstance(x, bool):
            return x
        if isinstance(x, (int, float)):
            return bool(x)
        s = str(x).strip().lower()
        if s in ("true", "yes", "1", "y"):
            return True
        if s in ("false", "no", "0", "n"):
            return False
        return default

    def vint(field: str, default=None):
        x = v(field, default)
        if x is None or isinstance(x, int):
            return x
        try:
            return int(float(x))
        except (ValueError, TypeError):
            return default

    def vfloat(field: str, default=None):
        x = v(field, default)
        if x is None or isinstance(x, (int, float)):
            return float(x) if x is not None else None
        try:
            return float(x)
        except (ValueError, TypeError):
            return default

    def vlist(field: str):
        x = v(field)
        if x is None:
            return None
        if isinstance(x, list):
            return [str(i) for i in x if i not in (None, "")]
        if isinstance(x, str) and x.strip():
            return [p.strip() for p in x.replace(";", ",").split(",") if p.strip()]
        return None

    activity_name = v("activity_name") or v("canonical_activity_name") or v("source_activity_name") or ""
    ef_value = vfloat("ef_value")
    ghg_species = v("ghg_species") or ("CO2e" if vbool("expressed_as_co2e", True) else "CO2")
    expressed = vbool("expressed_as_co2e")
    if expressed is None:
        expressed = ghg_species.upper() == "CO2E"

    return EmissionFactor(
        # Identity
        ef_id=v("ef_id"),
        activity_name=activity_name,
        activity_description=v("activity_description"),
        activity_code=v("activity_code"),
        emission_category=v("emission_category") or "unknown",
        sub_category=v("sub_category"),
        ghg_scope=str(v("ghg_scope") or "3"),
        scope3_category=v("scope3_category"),
        activity_level=v("activity_level"),
        # EF Value
        ef_value=ef_value if ef_value is not None else 0.0,
        ghg_species=ghg_species,
        expressed_as_co2e=expressed,
        gwp_basis=v("gwp_basis"),
        gwp_value_used=vfloat("gwp_value_used"),
        ef_type=v("ef_type") or "activity-based",
        # Units
        numerator_unit=v("numerator_unit") or "",
        denominator_unit=v("denominator_unit") or "",
        denominator_basis=v("denominator_basis"),
        unit_notes=v("unit_notes"),
        # Geography
        geography_type=v("geography_type") or ("global" if not v("country_iso") else "national"),
        country_iso=(v("country_iso") or "").upper()[:3] or None,
        region_name=v("region_name"),
        grid_zone_id=v("grid_zone_id"),
        location_basis=v("location_basis"),
        # Technology
        fuel_material_type=v("fuel_material_type"),
        technology_descriptor=v("technology_descriptor"),
        vehicle_type=v("vehicle_type"),
        end_use_sector=v("end_use_sector"),
        combustion_type=v("combustion_type"),
        carbon_content_fraction=vfloat("carbon_content_fraction"),
        # Temporal
        reference_year=vint("reference_year") or datetime.now(timezone.utc).year,
        valid_from=_parse_date(v("valid_from")),
        valid_to=_parse_date(v("valid_to")),
        ef_version=v("ef_version"),
        update_frequency=v("update_frequency"),
        # Source
        source_organization=v("source_organization") or v("source_name") or "Unknown",
        source_database=v("source_database"),
        publication_title=v("publication_title"),
        publication_year=vint("publication_year"),
        source_url=v("source_url"),
        original_ef_value=vfloat("original_ef_value"),
        original_unit=v("original_unit"),
        data_origin=v("data_origin") or "secondary",
        # Supplier / EPD provenance
        source_type=v("source_type"),
        supplier_name=v("supplier_name"),
        supplier_country=(v("supplier_country") or "").upper()[:3] or None,
        supplier_sector=v("supplier_sector"),
        supplier_epd_reference=v("supplier_epd_reference"),
        # Methodology
        calculation_method=v("calculation_method") or "activity-based",
        system_boundary=v("system_boundary") or "gate-to-gate",
        includes_biogenic_co2=vbool("includes_biogenic_co2"),
        includes_land_use_change=vbool("includes_land_use_change"),
        allocation_method=v("allocation_method"),
        upstream_included=vbool("upstream_included"),
        # DQ
        uncertainty_pct=vfloat("uncertainty_pct"),
        uncertainty_method=v("uncertainty_method"),
        dq_score_overall=vint("dq_score_overall"),
        dq_geographic_rep=vint("dq_geographic_rep"),
        dq_temporal_rep=vint("dq_temporal_rep"),
        dq_tech_rep=vint("dq_tech_rep"),
        third_party_verified=vbool("third_party_verified"),
        # Operational
        status=v("status") or "active",
        framework_tags=vlist("framework_tags"),
        sector_tags=vlist("sector_tags"),
        is_default_ef=vbool("is_default_ef"),
        notes=v("notes") or v("additional_notes"),
        # System links
        source_document_id=session.source_document_id,
        extraction_session_id=session.id,
        created_by_user_id=user_id,
        created_by="ingestion",
        created_at=datetime.now(timezone.utc),
    )


def _parse_date(value):
    if not value:
        return None
    from datetime import date as date_type
    if isinstance(value, date_type):
        return value
    try:
        from datetime import datetime
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


async def _get_session(session_id: uuid.UUID, db: AsyncSession) -> ExtractionSession:
    result = await db.execute(select(ExtractionSession).where(ExtractionSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    return session
