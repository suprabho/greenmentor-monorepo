import uuid
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.emission_factor import EmissionFactor, EmissionFactorVersion
from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User
from app.routers.auth import get_current_user, require_admin
from app.schemas.emission_factor import (
    EmissionFactorCreate, EmissionFactorUpdate, EmissionFactorOut,
    EmissionFactorListResponse, SupersedeRequest, VersionOut, ConflictingRecord,
)
from app.services.confidence_score import calculate_confidence
from app.services.conflict_detection import detect_conflicts
from app.services.embeddings import generate_embedding
import csv
import io
import json

router = APIRouter(prefix="/emission-factors", tags=["emission-factors"])


def _build_filter_query(
    q: Optional[str],
    year: Optional[int],
    country: Optional[str],
    region: Optional[str],
    scope: Optional[str],
    source_type: Optional[str],
    min_confidence: Optional[int],
    conflicts_only: bool,
    gwp_version: Optional[str],
    tags: Optional[str],
):
    """Build the WHERE clause for the EF list query."""
    conditions = [
        EmissionFactor.is_current == True,
        EmissionFactor.is_superseded == False,
    ]
    if q:
        # Trigram fallback (semantic handled separately in search endpoint)
        conditions.append(
            EmissionFactor.canonical_activity_name.ilike(f"%{q}%")
        )
    if year:
        conditions.append(
            or_(
                and_(EmissionFactor.validity_start <= date(year, 12, 31),
                     EmissionFactor.validity_end >= date(year, 1, 1)),
                and_(EmissionFactor.validity_start <= date(year, 12, 31),
                     EmissionFactor.validity_end == None),
            )
        )
    if country:
        conditions.append(
            or_(EmissionFactor.geography_country == country.upper(),
                EmissionFactor.geography_global == True)
        )
    if region:
        conditions.append(EmissionFactor.geography_region == region.upper())
    if scope:
        # applicable_scopes is JSON (not JSONB), so .contains() emits LIKE which
        # Postgres rejects on json values. Cast to jsonb so the `@>` containment
        # operator is used instead.
        conditions.append(
            cast(EmissionFactor.applicable_scopes, JSONB).contains([scope])
        )
    if source_type:
        conditions.append(EmissionFactor.source_type == source_type)
    if min_confidence is not None:
        conditions.append(EmissionFactor.confidence_score >= min_confidence)
    if conflicts_only:
        conditions.append(EmissionFactor.has_conflict == True)
    if gwp_version:
        conditions.append(EmissionFactor.gwp_version == gwp_version)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        for tag in tag_list:
            conditions.append(EmissionFactor.custom_tags.contains([tag]))
    return and_(*conditions)


@router.get("", response_model=EmissionFactorListResponse)
async def list_emission_factors(
    q: Optional[str] = Query(None, description="Keyword search on canonical activity name"),
    year: Optional[int] = Query(None),
    country: Optional[str] = Query(None, max_length=2),
    region: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    min_confidence: Optional[int] = Query(None, ge=0, le=100),
    conflicts_only: bool = Query(False),
    gwp_version: Optional[str] = Query(None),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    sort_by: str = Query("confidence_score", enum=["confidence_score", "canonical_activity_name", "created_at", "validity_start"]),
    sort_dir: str = Query("desc", enum=["asc", "desc"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = _build_filter_query(q, year, country, region, scope, source_type, min_confidence, conflicts_only, gwp_version, tags)
    count_q = select(func.count()).select_from(EmissionFactor).where(conditions)
    total = (await db.execute(count_q)).scalar()

    sort_col = getattr(EmissionFactor, sort_by, EmissionFactor.confidence_score)
    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    result = await db.execute(
        select(EmissionFactor)
        .where(conditions)
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return EmissionFactorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/search/semantic", response_model=EmissionFactorListResponse)
async def semantic_search(
    q: str = Query(..., min_length=2),
    year: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    min_confidence: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Semantic vector search on canonical activity name using pgvector."""
    embedding = await generate_embedding(q)
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    base_conditions = [
        EmissionFactor.is_current == True,
        EmissionFactor.is_superseded == False,
        EmissionFactor.name_embedding != None,
    ]
    if year:
        base_conditions.append(
            or_(
                and_(EmissionFactor.validity_start <= date(year, 12, 31),
                     EmissionFactor.validity_end >= date(year, 1, 1)),
                and_(EmissionFactor.validity_start <= date(year, 12, 31),
                     EmissionFactor.validity_end == None),
            )
        )
    if country:
        base_conditions.append(
            or_(EmissionFactor.geography_country == country.upper(),
                EmissionFactor.geography_global == True)
        )
    if min_confidence:
        base_conditions.append(EmissionFactor.confidence_score >= min_confidence)

    result = await db.execute(
        select(EmissionFactor)
        .where(and_(*base_conditions))
        .order_by(text(f"name_embedding <=> '{embedding_str}'"))
        .limit(limit)
    )
    items = result.scalars().all()
    return EmissionFactorListResponse(items=items, total=len(items), page=1, page_size=limit)


@router.get("/public", response_model=EmissionFactorListResponse)
async def list_emission_factors_public(
    q: Optional[str] = Query(None, description="Keyword search on canonical activity name"),
    country: Optional[str] = Query(None, max_length=2),
    scope: Optional[str] = Query(None),
    sort_by: str = Query("confidence_score", enum=["confidence_score", "canonical_activity_name", "created_at", "validity_start"]),
    sort_dir: str = Query("desc", enum=["asc", "desc"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Unauthenticated read-only listing of emission factors.

    Exposes a tighter query surface than the authenticated endpoint so the
    public attack/scrape surface stays small. Intended for downstream tools
    (e.g. the ls-ingestion bill extractor) that only need to look up factors
    by activity + country + scope.
    """
    conditions = _build_filter_query(q, None, country, None, scope, None, None, False, None, None)
    count_q = select(func.count()).select_from(EmissionFactor).where(conditions)
    total = (await db.execute(count_q)).scalar()

    sort_col = getattr(EmissionFactor, sort_by, EmissionFactor.confidence_score)
    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    result = await db.execute(
        select(EmissionFactor)
        .where(conditions)
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return EmissionFactorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{ef_id}", response_model=EmissionFactorOut)
async def get_emission_factor(
    ef_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))
    ef = result.scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Emission factor not found")
    return ef


@router.get("/{ef_id}/versions", response_model=list[VersionOut])
async def get_versions(
    ef_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EmissionFactorVersion)
        .where(EmissionFactorVersion.emission_factor_id == ef_id)
        .order_by(EmissionFactorVersion.version_number.desc())
    )
    return result.scalars().all()


@router.get("/{ef_id}/conflicts", response_model=list[ConflictingRecord])
async def get_conflicts(
    ef_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ef = (await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))).scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Not found")
    conflicts = await detect_conflicts(ef, db, exclude_id=ef_id)
    return conflicts


@router.patch("/{ef_id}", response_model=EmissionFactorOut)
async def update_emission_factor(
    ef_id: uuid.UUID,
    data: EmissionFactorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))
    ef = result.scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Not found")

    # Snapshot before edit
    snapshot = EmissionFactorOut.model_validate(ef).model_dump(mode="json")
    version = EmissionFactorVersion(
        emission_factor_id=ef.id,
        version_number=ef.version_number,
        snapshot=snapshot,
        edited_by=current_user.id,
        edit_summary=data.edit_summary,
    )
    db.add(version)

    # Apply updates
    update_dict = data.model_dump(exclude_none=True, exclude={"edit_summary"})
    for field, value in update_dict.items():
        setattr(ef, field, value)
    ef.version_number += 1
    ef.last_edited_by = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)

    # Recalculate confidence
    config = await _get_active_config(db)
    score, breakdown = calculate_confidence(ef, config)
    ef.confidence_score = score
    ef.confidence_breakdown = breakdown

    # Regenerate embedding if canonical name changed
    if "canonical_activity_name" in update_dict:
        ef.name_embedding = await generate_embedding(ef.canonical_activity_name)

    # Serialize update_dict for audit log — date/datetime objects are not JSON serializable
    def _to_json_safe(obj):
        if isinstance(obj, dict):
            return {k: _to_json_safe(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_to_json_safe(v) for v in obj]
        if hasattr(obj, "isoformat"):   # date, datetime
            return obj.isoformat()
        return obj

    db.add(AuditLog(
        action=AuditAction.record_edited,
        actor_id=current_user.id,
        emission_factor_id=ef.id,
        details={"changes": _to_json_safe(update_dict), "version": ef.version_number},
    ))
    await db.commit()
    await db.refresh(ef)
    return ef


@router.post("/{ef_id}/resolve-conflict", response_model=EmissionFactorOut)
async def resolve_conflict(
    ef_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Mark a conflicting record as reviewed / resolved. Clears has_conflict flag."""
    ef = (await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))).scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Not found")
    ef.has_conflict = False
    ef.last_edited_by = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)
    resolution_note = data.get("resolution_note") or ""
    db.add(AuditLog(
        action=AuditAction.conflict_resolved,
        actor_id=current_user.id,
        emission_factor_id=ef.id,
        details={"resolution_note": resolution_note},
    ))
    await db.commit()
    await db.refresh(ef)
    return ef


@router.post("/{ef_id}/supersede", response_model=EmissionFactorOut)
async def supersede_emission_factor(
    ef_id: uuid.UUID,
    data: SupersedeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))
    ef = result.scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Not found")
    ef.is_superseded = True
    ef.superseded_reason = data.reason
    ef.last_edited_by = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        action=AuditAction.record_superseded,
        actor_id=current_user.id,
        emission_factor_id=ef.id,
        details={"reason": data.reason},
    ))
    await db.commit()
    await db.refresh(ef)
    return ef


@router.post("/{ef_id}/restore-version/{version_number}", response_model=EmissionFactorOut)
async def restore_version(
    ef_id: uuid.UUID,
    version_number: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    ef = (await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))).scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Not found")
    version = (await db.execute(
        select(EmissionFactorVersion)
        .where(and_(EmissionFactorVersion.emission_factor_id == ef_id,
                    EmissionFactorVersion.version_number == version_number))
    )).scalar_one_or_none()
    if not version:
        raise HTTPException(404, "Version not found")

    # Take snapshot of current state before restoring
    snapshot = EmissionFactorOut.model_validate(ef).model_dump(mode="json")
    db.add(EmissionFactorVersion(
        emission_factor_id=ef.id,
        version_number=ef.version_number,
        snapshot=snapshot,
        edited_by=current_user.id,
        edit_summary=f"Snapshot before restoring to v{version_number}",
    ))

    # Apply the old snapshot (exclude system fields)
    exclude = {"id", "version_number", "is_current", "is_superseded", "created_by", "created_at",
               "last_edited_by", "last_edited_at", "has_conflict", "migrated", "confidence_score",
               "confidence_breakdown", "name_embedding", "source_document_id", "extraction_session_id",
               "superseded_by_id", "superseded_reason"}
    for field, value in version.snapshot.items():
        if field not in exclude:
            try:
                setattr(ef, field, value)
            except AttributeError:
                pass
    ef.version_number += 1
    ef.last_edited_by = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)
    ef.is_superseded = False

    db.add(AuditLog(
        action=AuditAction.version_restored,
        actor_id=current_user.id,
        emission_factor_id=ef.id,
        details={"restored_to_version": version_number},
    ))
    await db.commit()
    await db.refresh(ef)
    return ef


@router.get("/{ef_id}/audit-log")
async def get_audit_log(
    ef_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.emission_factor_id == ef_id)
        .order_by(AuditLog.created_at.desc())
    )
    return result.scalars().all()


@router.get("/export/csv")
async def export_csv(
    q: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    min_confidence: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = _build_filter_query(q, year, country, region, scope, source_type, min_confidence, False, None, None)
    result = await db.execute(select(EmissionFactor).where(conditions).order_by(EmissionFactor.confidence_score.desc()))
    records = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    headers = [
        "id", "canonical_activity_name", "source_activity_name", "unit",
        "ef_total_co2e", "ef_co2", "ef_ch4", "ef_n2o", "ef_pfc", "ef_sf6", "ef_nf3",
        "applicable_scopes", "lca_stages", "source_name", "source_type", "source_url",
        "validity_start", "validity_end", "geography_global", "geography_country", "geography_region",
        "gwp_version", "confidence_score", "has_conflict", "is_superseded",
        "comments_applicability", "comments_limitations", "custom_tags", "additional_notes",
        "created_at", "version_number",
    ]
    writer.writerow(headers)
    for r in records:
        writer.writerow([
            r.id, r.canonical_activity_name, r.source_activity_name, r.unit,
            r.ef_total_co2e, r.ef_co2, r.ef_ch4, r.ef_n2o, r.ef_pfc, r.ef_sf6, r.ef_nf3,
            json.dumps(r.applicable_scopes), json.dumps(r.lca_stages),
            r.source_name, r.source_type, r.source_url,
            r.validity_start, r.validity_end, r.geography_global, r.geography_country, r.geography_region,
            r.gwp_version, r.confidence_score, r.has_conflict, r.is_superseded,
            r.comments_applicability, r.comments_limitations,
            json.dumps(r.custom_tags), r.additional_notes,
            r.created_at, r.version_number,
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=emission_factors.csv"},
    )


async def _get_active_config(db: AsyncSession) -> dict:
    from app.models.confidence_config import ConfidenceWeightConfig
    result = await db.execute(
        select(ConfidenceWeightConfig).where(ConfidenceWeightConfig.is_active == True)
    )
    config = result.scalar_one_or_none()
    return config.weights if config else ConfidenceWeightConfig.default_weights()
