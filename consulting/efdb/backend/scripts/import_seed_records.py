"""
One-shot importer for the 78 seed emission factor records from the
standalone Claude/EFDB project (ef_data.json) into the live EFDB Postgres
on Supabase, using the source-schema EmissionFactor model.

Skips any record whose canonical activity_name already exists in the
table (case-insensitive). Reports counts at the end.

Run inside the backend container:
    docker exec efdb-backend-1 python -m scripts.import_seed_records \\
        /app/uploads/seed_ef_data.json
"""
import asyncio
import json
import sys
from datetime import datetime, date, timezone
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.emission_factor import EmissionFactor
from app.models.user import User


def _parse_date(v):
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _bool(v):
    if v is None or isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "y", "t"):
        return True
    if s in ("false", "0", "no", "n", "f", ""):
        return False
    return None


async def _resolve_admin_user_id(db) -> str | None:
    """Pick the first admin user as the EFDB-internal owner of imported rows."""
    r = await db.execute(
        select(User.id).where(User.role == "admin").order_by(User.created_at).limit(1)
    )
    row = r.first()
    return row[0] if row else None


async def main(path: str):
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    records = payload.get("records") or []
    if not records:
        print("No records found in payload.")
        return

    async with AsyncSessionLocal() as db:
        owner_id = await _resolve_admin_user_id(db)
        if not owner_id:
            print("Warning: no admin user found — created_by_user_id will be NULL.")

        # Existing canonical names (case-insensitive)
        existing_q = await db.execute(
            select(func.lower(EmissionFactor.activity_name))
        )
        existing = {row[0] for row in existing_q}

        inserted = 0
        skipped_dup = 0
        skipped_err = 0
        for raw in records:
            name = (raw.get("activity_name") or "").strip()
            if not name:
                skipped_err += 1
                continue
            if name.lower() in existing:
                skipped_dup += 1
                continue

            try:
                ef = EmissionFactor(
                    # Identity
                    ef_id=raw.get("ef_id"),
                    activity_name=name,
                    activity_description=raw.get("activity_description"),
                    activity_code=raw.get("activity_code"),
                    emission_category=raw.get("emission_category") or "unknown",
                    sub_category=raw.get("sub_category"),
                    ghg_scope=str(raw.get("ghg_scope") or "3"),
                    scope3_category=raw.get("scope3_category"),
                    activity_level=raw.get("activity_level"),
                    # EF Value
                    ef_value=float(raw["ef_value"]),
                    ghg_species=raw.get("ghg_species") or "CO2e",
                    expressed_as_co2e=_bool(raw.get("expressed_as_co2e")) or False,
                    gwp_basis=raw.get("gwp_basis"),
                    gwp_value_used=raw.get("gwp_value_used"),
                    ef_type=raw.get("ef_type") or "activity-based",
                    # Units
                    numerator_unit=raw.get("numerator_unit") or "",
                    denominator_unit=raw.get("denominator_unit") or "",
                    denominator_basis=raw.get("denominator_basis"),
                    unit_notes=raw.get("unit_notes"),
                    # Geography
                    geography_type=raw.get("geography_type") or "global",
                    country_iso=(raw.get("country_iso") or "").upper()[:3] or None,
                    region_name=raw.get("region_name"),
                    grid_zone_id=raw.get("grid_zone_id"),
                    location_basis=raw.get("location_basis"),
                    # Technology
                    fuel_material_type=raw.get("fuel_material_type"),
                    technology_descriptor=raw.get("technology_descriptor"),
                    vehicle_type=raw.get("vehicle_type"),
                    end_use_sector=raw.get("end_use_sector"),
                    combustion_type=raw.get("combustion_type"),
                    carbon_content_fraction=raw.get("carbon_content_fraction"),
                    # Temporal
                    reference_year=int(raw.get("reference_year") or datetime.now(timezone.utc).year),
                    valid_from=_parse_date(raw.get("valid_from")),
                    valid_to=_parse_date(raw.get("valid_to")),
                    ef_version=raw.get("ef_version"),
                    update_frequency=raw.get("update_frequency"),
                    # Source
                    source_organization=raw.get("source_organization") or "Unknown",
                    source_database=raw.get("source_database"),
                    publication_title=raw.get("publication_title"),
                    publication_year=raw.get("publication_year"),
                    source_url=raw.get("source_url"),
                    original_ef_value=raw.get("original_ef_value"),
                    original_unit=raw.get("original_unit"),
                    data_origin=raw.get("data_origin") or "secondary",
                    # Methodology
                    calculation_method=raw.get("calculation_method") or "activity-based",
                    system_boundary=raw.get("system_boundary") or "gate-to-gate",
                    includes_biogenic_co2=_bool(raw.get("includes_biogenic_co2")),
                    includes_land_use_change=_bool(raw.get("includes_land_use_change")),
                    allocation_method=raw.get("allocation_method"),
                    upstream_included=_bool(raw.get("upstream_included")),
                    # DQ
                    uncertainty_pct=raw.get("uncertainty_pct"),
                    uncertainty_method=raw.get("uncertainty_method"),
                    dq_score_overall=raw.get("dq_score_overall"),
                    dq_geographic_rep=raw.get("dq_geographic_rep"),
                    dq_temporal_rep=raw.get("dq_temporal_rep"),
                    dq_tech_rep=raw.get("dq_tech_rep"),
                    third_party_verified=_bool(raw.get("third_party_verified")),
                    # Operational
                    status=raw.get("status") or "active",
                    superseded_by_ef_id=raw.get("superseded_by_ef_id"),
                    framework_tags=raw.get("framework_tags"),
                    sector_tags=raw.get("sector_tags"),
                    is_default_ef=_bool(raw.get("is_default_ef")),
                    notes=raw.get("notes"),
                    # System
                    created_by=raw.get("created_by") or "seed-import",
                    created_by_user_id=owner_id,
                )
                db.add(ef)
                existing.add(name.lower())
                inserted += 1
            except Exception as e:
                skipped_err += 1
                print(f"  ! skip ({e}): {name[:60]}")

        await db.commit()
        print(f"\nInserted: {inserted}")
        print(f"Skipped (duplicate canonical name): {skipped_dup}")
        print(f"Skipped (errors): {skipped_err}")
        total_q = await db.execute(select(func.count()).select_from(EmissionFactor))
        print(f"Total rows in emission_factors now: {total_q.scalar()}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/app/uploads/seed_ef_data.json"
    asyncio.run(main(path))
