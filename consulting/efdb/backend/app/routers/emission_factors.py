import uuid
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
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


# Source schema sort keys, mapped to model attributes.
SORT_COLUMNS = {
    "activity_name": EmissionFactor.activity_name,
    "reference_year": EmissionFactor.reference_year,
    "created_at": EmissionFactor.created_at,
    "valid_from": EmissionFactor.valid_from,
    "source_organization": EmissionFactor.source_organization,
    "dq_score_overall": EmissionFactor.dq_score_overall,
}


def _build_filter_query(
    q: Optional[str],
    year: Optional[int],
    country: Optional[str],
    region: Optional[str],
    scope: Optional[str],
    species: Optional[str],
    category: Optional[str],
    source_organization: Optional[str],
    max_dq_score: Optional[int],
    conflicts_only: bool,
    gwp_basis: Optional[str],
    framework_tags: Optional[str],
    sector_tags: Optional[str],
    include_superseded: bool = False,
):
    """Build the WHERE clause for the EF list query."""
    conditions = []
    if not include_superseded:
        conditions.append(EmissionFactor.status == "active")
    if q:
        conditions.append(EmissionFactor.activity_name.ilike(f"%{q}%"))
    if year:
        conditions.append(
            or_(
                EmissionFactor.reference_year == year,
                and_(EmissionFactor.valid_from <= date(year, 12, 31),
                     EmissionFactor.valid_to >= date(year, 1, 1)),
                and_(EmissionFactor.valid_from <= date(year, 12, 31),
                     EmissionFactor.valid_to == None),
            )
        )
    if country:
        # Accept ISO2 (back-compat) or ISO3; uppercase, take first 3 chars.
        iso = country.upper()[:3]
        conditions.append(
            or_(EmissionFactor.country_iso == iso,
                EmissionFactor.geography_type == "global")
        )
    if region:
        conditions.append(EmissionFactor.region_name.ilike(f"%{region}%"))
    if scope:
        # Accept "1" / "Scope 1" / "scope1" / etc → keep just the digit
        digit = "".join(c for c in scope if c.isdigit())
        if digit:
            conditions.append(EmissionFactor.ghg_scope == digit)
    if species:
        conditions.append(EmissionFactor.ghg_species.ilike(species))
    if category:
        conditions.append(EmissionFactor.emission_category.ilike(category))
    if source_organization:
        conditions.append(EmissionFactor.source_organization.ilike(f"%{source_organization}%"))
    if max_dq_score is not None:
        conditions.append(EmissionFactor.dq_score_overall <= max_dq_score)
    if conflicts_only:
        conditions.append(EmissionFactor.has_conflict == True)
    if gwp_basis:
        conditions.append(EmissionFactor.gwp_basis.ilike(gwp_basis))
    if framework_tags:
        for tag in (t.strip() for t in framework_tags.split(",") if t.strip()):
            conditions.append(EmissionFactor.framework_tags.contains([tag]))
    if sector_tags:
        for tag in (t.strip() for t in sector_tags.split(",") if t.strip()):
            conditions.append(EmissionFactor.sector_tags.contains([tag]))
    return and_(*conditions) if conditions else text("true")


def _resolve_sort(sort_by: str, sort_dir: str):
    col = SORT_COLUMNS.get(sort_by, EmissionFactor.created_at)
    return col.desc() if sort_dir == "desc" else col.asc()


@router.get("", response_model=EmissionFactorListResponse)
async def list_emission_factors(
    q: Optional[str] = Query(None, description="Substring search on activity_name"),
    year: Optional[int] = Query(None),
    country: Optional[str] = Query(None, description="ISO 3166 alpha-3 country code"),
    region: Optional[str] = Query(None),
    scope: Optional[str] = Query(None, description="GHG scope (1, 2, or 3)"),
    species: Optional[str] = Query(None, description="GHG species (CO2, CO2e, CH4, N2O, ...)"),
    category: Optional[str] = Query(None, description="emission_category"),
    source_organization: Optional[str] = Query(None),
    max_dq_score: Optional[int] = Query(None, ge=1, le=5,
                                        description="Pedigree DQ score (1=best, 5=worst)"),
    conflicts_only: bool = Query(False),
    gwp_basis: Optional[str] = Query(None),
    framework_tags: Optional[str] = Query(None, description="Comma-separated framework tags"),
    sector_tags: Optional[str] = Query(None, description="Comma-separated sector tags"),
    include_superseded: bool = Query(False),
    sort_by: str = Query("created_at",
                         enum=list(SORT_COLUMNS.keys())),
    sort_dir: str = Query("desc", enum=["asc", "desc"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = _build_filter_query(
        q, year, country, region, scope, species, category, source_organization,
        max_dq_score, conflicts_only, gwp_basis, framework_tags, sector_tags,
        include_superseded,
    )
    count_q = select(func.count()).select_from(EmissionFactor).where(conditions)
    total = (await db.execute(count_q)).scalar()
    order = _resolve_sort(sort_by, sort_dir)
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
    max_dq_score: Optional[int] = Query(None, ge=1, le=5),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Semantic vector search on activity_name using pgvector."""
    embedding = await generate_embedding(q)
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    base_conditions = [
        EmissionFactor.status == "active",
        EmissionFactor.name_embedding != None,
    ]
    if year:
        base_conditions.append(
            or_(EmissionFactor.reference_year == year,
                and_(EmissionFactor.valid_from <= date(year, 12, 31),
                     EmissionFactor.valid_to >= date(year, 1, 1)),
                and_(EmissionFactor.valid_from <= date(year, 12, 31),
                     EmissionFactor.valid_to == None))
        )
    if country:
        iso = country.upper()[:3]
        base_conditions.append(
            or_(EmissionFactor.country_iso == iso,
                EmissionFactor.geography_type == "global")
        )
    if max_dq_score is not None:
        base_conditions.append(EmissionFactor.dq_score_overall <= max_dq_score)

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
    q: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    sort_by: str = Query("created_at", enum=list(SORT_COLUMNS.keys())),
    sort_dir: str = Query("desc", enum=["asc", "desc"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Unauthenticated read-only listing of emission factors. Exposes a tighter
    query surface than the authenticated endpoint so the public attack /
    scrape surface stays small. Intended for downstream tools that only
    need to look up factors by activity + country + scope.
    """
    conditions = _build_filter_query(
        q, None, country, None, scope, species, None, None,
        None, False, None, None, None, False,
    )
    count_q = select(func.count()).select_from(EmissionFactor).where(conditions)
    total = (await db.execute(count_q)).scalar()
    order = _resolve_sort(sort_by, sort_dir)
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
    return await detect_conflicts(ef, db, exclude_id=ef_id)


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

    snapshot = EmissionFactorOut.model_validate(ef).model_dump(mode="json")
    db.add(EmissionFactorVersion(
        emission_factor_id=ef.id,
        version_number=ef.version_number,
        snapshot=snapshot,
        edited_by=current_user.id,
        edit_summary=data.edit_summary,
    ))

    update_dict = data.model_dump(exclude_none=True, exclude={"edit_summary"})
    for field, value in update_dict.items():
        setattr(ef, field, value)
    ef.version_number += 1
    ef.last_edited_by_user_id = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)

    if "activity_name" in update_dict:
        ef.name_embedding = await generate_embedding(ef.activity_name)

    def _to_json_safe(obj):
        if isinstance(obj, dict):
            return {k: _to_json_safe(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_to_json_safe(v) for v in obj]
        if hasattr(obj, "isoformat"):
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
    ef = (await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))).scalar_one_or_none()
    if not ef:
        raise HTTPException(404, "Not found")
    ef.has_conflict = False
    ef.last_edited_by_user_id = current_user.id
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
    ef.status = "superseded"
    ef.superseded_reason = data.reason
    ef.superseded_by_ef_id = data.superseded_by_ef_id
    ef.last_edited_by_user_id = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        action=AuditAction.record_superseded,
        actor_id=current_user.id,
        emission_factor_id=ef.id,
        details={"reason": data.reason, "superseded_by_ef_id": data.superseded_by_ef_id},
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

    snapshot = EmissionFactorOut.model_validate(ef).model_dump(mode="json")
    db.add(EmissionFactorVersion(
        emission_factor_id=ef.id,
        version_number=ef.version_number,
        snapshot=snapshot,
        edited_by=current_user.id,
        edit_summary=f"Snapshot before restoring to v{version_number}",
    ))

    exclude = {
        "id", "version_number", "created_at", "updated_at",
        "created_by_user_id", "last_edited_by_user_id", "last_edited_at",
        "has_conflict", "name_embedding",
        "source_document_id", "extraction_session_id",
    }
    for field, value in version.snapshot.items():
        if field not in exclude:
            try:
                setattr(ef, field, value)
            except AttributeError:
                pass
    ef.version_number += 1
    ef.last_edited_by_user_id = current_user.id
    ef.last_edited_at = datetime.now(timezone.utc)
    ef.status = "active"

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


# ── CSV export with all source-schema columns ──────────────────────────────
CSV_COLUMNS = [
    "id", "ef_id", "activity_name", "activity_description", "activity_code",
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
    "status", "superseded_by_ef_id", "superseded_reason", "framework_tags",
    "sector_tags", "is_default_ef", "created_at", "updated_at", "created_by", "notes",
    "version_number", "has_conflict",
]


@router.get("/export/csv")
async def export_csv(
    q: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source_organization: Optional[str] = Query(None),
    max_dq_score: Optional[int] = Query(None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = _build_filter_query(
        q, year, country, region, scope, species, category, source_organization,
        max_dq_score, False, None, None, None, False,
    )
    result = await db.execute(
        select(EmissionFactor).where(conditions).order_by(EmissionFactor.activity_name.asc())
    )
    records = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)
    for r in records:
        row = []
        for col in CSV_COLUMNS:
            v = getattr(r, col, None)
            if isinstance(v, (list, dict)):
                v = json.dumps(v)
            row.append(v)
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=emission_factors.csv"},
    )
