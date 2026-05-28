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
)
from app.services.extraction.pdf_agent import scan_pdf, extract_from_pdf
from app.services.extraction.excel_agent import scan_excel, extract_from_excel
from app.services.extraction.url_agent import fetch_and_scan_url, extract_from_url
from app.services.confidence_score import calculate_confidence
from app.services.conflict_detection import detect_and_flag_conflicts
from app.services.embeddings import generate_embedding
from app.config import settings
import httpx

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


async def _save_upload(file: UploadFile, user_id: str) -> tuple[str, str]:
    """Save uploaded file to disk, return (file_path, mime_type)."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "upload")[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.upload_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return file_path, file.content_type or "application/octet-stream"


# ── Step 1: Upload and scan ────────────────────────────────────────────────

@router.post("/upload/scan", response_model=ScanResult)
async def upload_and_scan(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload a PDF or Excel and return the list of tables/sections found."""
    if file.size and file.size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_size_mb}MB limit")

    file_path, mime_type = await _save_upload(file, str(current_user.id))
    file_size = os.path.getsize(file_path)

    doc = SourceDocument(
        original_filename=file.filename,
        file_path=file_path,
        mime_type=mime_type,
        file_size_bytes=file_size,
        uploaded_by=current_user.id,
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

    # Scan the document to find EF tables/sections
    if "pdf" in mime_type or (file.filename or "").lower().endswith(".pdf"):
        scan_result = await scan_pdf(file_path, str(doc.id), str(session.id))
    elif "excel" in mime_type or "spreadsheet" in mime_type or (file.filename or "").lower().endswith((".xlsx", ".xls", ".csv")):
        scan_result = await scan_excel(file_path, str(doc.id), str(session.id))
    else:
        raise HTTPException(415, "Unsupported file type. Upload a PDF, Excel, or CSV.")

    # Update document with cost estimate
    doc.estimated_tokens = scan_result.estimated_tokens
    doc.estimated_cost_usd = scan_result.estimated_cost_usd
    session.status = SessionStatus.awaiting_review
    await db.commit()

    return scan_result


@router.post("/url/scan", response_model=ScanResult)
async def url_scan(
    url: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Fetch a URL and scan it for EF tables."""
    doc = SourceDocument(
        source_url=url,
        uploaded_by=current_user.id,
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

    scan_result = await fetch_and_scan_url(url, str(doc.id), str(session.id))
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
        try:
            if doc.file_path:
                if doc.mime_type and ("pdf" in doc.mime_type or doc.file_path.endswith(".pdf")):
                    records = await extract_from_pdf(doc.file_path, sections, confirmed_metadata)
                else:
                    records = await extract_from_excel(doc.file_path, sections, confirmed_metadata)
            else:
                records = await extract_from_url(doc.source_url, sections, confirmed_metadata)

            session.extraction_result = [r.model_dump(mode="json") for r in records]
            session.total_extracted = len(records)
            session.review_progress = {"approved": [], "rejected": [], "pending": list(range(len(records)))}
            session.status = SessionStatus.in_review
        except Exception as e:
            session.status = SessionStatus.failed
            session.error_message = str(e)
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
        score, breakdown = calculate_confidence(ef, weights)
        ef.confidence_score = score
        ef.confidence_breakdown = breakdown
        ef.name_embedding = await generate_embedding(ef.canonical_activity_name)
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

    return ReviewSummary(
        approved=len(approved_indices),
        rejected=len(rejected_indices),
        conflicts_flagged=conflicts_flagged,
        records_committed=committed_ids,
    )


def _build_ef_from_extraction(raw: dict, session: ExtractionSession, user_id: uuid.UUID) -> EmissionFactor:
    """Convert a raw extraction dict (as stored in session) to an EmissionFactor model instance."""
    def val(field: str):
        """Extract the 'value' sub-key from an ExtractionFieldResult dict."""
        entry = raw.get(field, {})
        if isinstance(entry, dict):
            return entry.get("value")
        return entry

    # ── Enum sanitisers ──────────────────────────────────────────────────────
    GWP_VALID = {"ar4", "ar5", "ar6", "gwp20", "gwp100", "not_stated"}
    SOURCE_TYPE_VALID = {
        "government", "intergovernmental", "ghg_protocol", "commercial_lca",
        "peer_reviewed", "industry_association", "supplier_epd",
        "internal_estimate", "other",
    }

    def _gwp(v):
        if not v:
            return None
        s = str(v).lower().replace(" ", "_").replace("-", "_")
        return s if s in GWP_VALID else None

    def _source_type(v):
        if not v:
            return None
        s = str(v).lower().replace(" ", "_").replace("-", "_")
        # common aliases Claude returns
        aliases = {
            "supplier_epd": "supplier_epd",
            "supplier": "supplier_epd",
            "epd": "supplier_epd",
            "government_regulatory_body": "government",
            "government___regulatory_body": "government",
            "governmental": "government",
            "intergovernmental_body": "intergovernmental",
            "ghg_protocol___industry_standard": "ghg_protocol",
            "commercial_lca_database_export": "commercial_lca",
            "peer_reviewed_publication": "peer_reviewed",
            "industry_association": "industry_association",
            "internal_estimate": "internal_estimate",
        }
        s = aliases.get(s, s)
        return s if s in SOURCE_TYPE_VALID else "other"

    def _country(v):
        """Keep only first 2 chars of ISO country code; strip longer values."""
        if not v:
            return None
        s = str(v).strip()
        return s[:2].upper() if len(s) >= 2 else None

    def _supplier_countries(v):
        """Return a list of ISO 2-char country codes. Accepts string or list."""
        if not v:
            return None
        if isinstance(v, list):
            codes = [str(c).strip()[:2].upper() for c in v if c and str(c).strip()]
        else:
            # Claude may return comma-separated string or single code
            parts = str(v).replace(';', ',').split(',')
            codes = [p.strip()[:2].upper() for p in parts if p.strip()]
        return codes if codes else None

    def _region(v):
        """Truncate geography_region to varchar(10) limit."""
        if not v:
            return None
        return str(v)[:10]

    return EmissionFactor(
        source_activity_name=val("source_activity_name") or "",
        canonical_activity_name=val("canonical_activity_name") or val("source_activity_name") or "",
        activity_category=val("activity_category"),
        unit=val("unit") or "",
        ef_total_co2e=val("ef_total_co2e"),
        ef_co2=val("ef_co2"),
        ef_ch4=val("ef_ch4"),
        ef_n2o=val("ef_n2o"),
        ef_pfc=val("ef_pfc"),
        ef_sf6=val("ef_sf6"),
        ef_nf3=val("ef_nf3"),
        applicable_scopes=val("applicable_scopes"),
        lca_stages=val("lca_stages"),
        source_name=val("source_name"),
        source_type=_source_type(val("source_type")),
        source_url=val("source_url"),
        validity_start=_parse_date(val("validity_start")),
        validity_end=_parse_date(val("validity_end")),
        geography_global=bool(val("geography_global")),
        geography_country=_country(val("geography_country")),
        geography_region=_region(val("geography_region")),
        gwp_version=_gwp(val("gwp_version")),
        supplier_name=val("supplier_name"),
        supplier_country=_supplier_countries(val("supplier_country")),
        supplier_sector=val("supplier_sector"),
        supplier_epd_reference=val("supplier_epd_reference"),
        comments_applicability=val("comments_applicability"),
        comments_limitations=val("comments_limitations"),
        custom_tags=val("custom_tags"),
        additional_notes=val("additional_notes"),
        source_document_id=session.source_document_id,
        extraction_session_id=session.id,
        created_by=user_id,
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
