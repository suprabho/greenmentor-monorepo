"""
Importer for the scraped India EPD dataset (data/india_epds_enriched.json)
into the EFDB emission_factors table as supplier-specific factors.

Maps each EPD with a structured GWP A1-A3 result + declared unit to one
EmissionFactor record (cradle-to-gate, scope 3 cat 1, source_type
"Supplier-provided / EPD", supplier fields populated). Where the declared
unit is a simple "<amount> <unit>" (e.g. "1000 kg"), the EF value is
normalised to per-1-unit; otherwise the declared-unit text is kept as the
denominator basis and the value left as-published.

Requires migration 0004 (supplier/source_type columns) to be applied.

Dry-run locally (no DB, stdlib only):
    python3 scripts/import_india_epds.py ../data/india_epds_enriched.json --dry-run

Run inside the backend container:
    python -m scripts.import_india_epds /app/uploads/india_epds_enriched.json
"""
import json
import re
import sys
from datetime import datetime, date

CREATED_BY = "epd-india-import"
SOURCE_TYPE = "Supplier-provided / EPD"

# declared units we normalise to per-1-unit EF values
SIMPLE_UNIT = re.compile(
    r"^(?P<amount>\d+(?:\.\d+)?)\s+(?P<unit>kg|t|tonne|m|m2|m3|pcs\.?|l|kWh)$", re.I
)


def _parse_date(v):
    if not v:
        return None
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def map_record(epd: dict) -> dict | None:
    """Map one enriched EPD record to EmissionFactor kwargs (pure, no DB)."""
    gwp = epd.get("gwp_a1a3")
    declared_unit = (epd.get("declared_unit") or "").strip()
    name = (epd.get("product_name") or "").strip()
    manufacturer = (epd.get("manufacturer") or "").strip()
    if gwp is None or not declared_unit or not name:
        return None

    m = SIMPLE_UNIT.match(declared_unit)
    if m:
        amount = float(m.group("amount"))
        denominator_unit = m.group("unit").rstrip(".")
        ef_value = gwp / amount if amount else gwp
    else:
        # composite/custom basis (e.g. "1 m2 of plasterboard ... 12.5 mm",
        # "1 Wp of <module>") — keep as-published against the full basis text
        denominator_unit = declared_unit
        ef_value = gwp

    notes_bits = [
        f"Imported from EPD {epd['registration_number']} "
        f"(International EPD System, environdec.com).",
        f"Indicator: {epd.get('gwp_a1a3_indicator') or 'GWP-GHG'}, modules A1-A3, "
        f"as published: {gwp:g} kg CO2e per {declared_unit}.",
    ]
    if epd.get("gwp_fossil_a1a3") is not None:
        notes_bits.append(f"GWP-fossil A1-A3: {epd['gwp_fossil_a1a3']:g}.")
    if epd.get("gwp_biogenic_a1a3") is not None:
        notes_bits.append(f"GWP-biogenic A1-A3: {epd['gwp_biogenic_a1a3']:g}.")
    if epd.get("pcr"):
        notes_bits.append(f"PCR: {epd['pcr']}.")
    if epd.get("life_cycle_stages"):
        notes_bits.append(f"Declared modules: {epd['life_cycle_stages']}.")

    valid_from = _parse_date(epd.get("version_date")) or _parse_date(
        epd.get("publication_date"))
    reference_year = (
        int(epd["year_published"]) if epd.get("year_published")
        else (valid_from or date.today()).year
    )

    # avoid "Product by Acme — Acme" when the EPD title already names the maker
    mfr_token = re.sub(r"\b(pvt|private|ltd|limited|india)\b\.?", "",
                       manufacturer, flags=re.I).strip(" .,")
    if mfr_token and mfr_token.lower() in name.lower():
        activity_name = name
    else:
        activity_name = f"{name} — {manufacturer}" if manufacturer else name

    return dict(
        activity_name=activity_name,
        activity_description=(
            f"Supplier-specific cradle-to-gate (A1-A3) factor from the EPD for "
            f"{name} by {manufacturer}."
        ),
        emission_category="material",
        sub_category=epd.get("material_category"),
        ghg_scope="3",
        scope3_category="1: Purchased goods & services",
        ef_value=ef_value,
        ghg_species="CO2e",
        expressed_as_co2e=True,
        ef_type="activity-based",
        numerator_unit="kg CO2e",
        denominator_unit=denominator_unit,
        denominator_basis=f"declared unit: {declared_unit}",
        geography_type="country",
        country_iso="IN",
        reference_year=reference_year,
        valid_from=valid_from,
        valid_to=_parse_date(epd.get("valid_until")),
        ef_version=epd["registration_number"].split(":")[-1],
        source_organization=manufacturer or "Unknown",
        source_database="International EPD System (environdec.com)",
        publication_title=f"EPD: {name}",
        publication_year=reference_year,
        source_url=epd.get("epd_url"),
        original_ef_value=gwp,
        original_unit=f"kg CO2e / {declared_unit}",
        data_origin="primary",
        calculation_method="supplier-specific",
        system_boundary="cradle-to-gate",
        includes_biogenic_co2=epd.get("gwp_biogenic_a1a3") is not None,
        third_party_verified=True,  # ISO 14025 EPDs are independently verified
        status="active",
        sector_tags=[epd["material_category"]] if epd.get("material_category") else None,
        notes=" ".join(notes_bits),
        source_type=SOURCE_TYPE,
        supplier_name=manufacturer or None,
        supplier_country="IND",
        supplier_sector=epd.get("material_category"),
        supplier_epd_reference=epd["registration_number"],
        created_by=CREATED_BY,
    )


def load_mapped(path: str) -> tuple[list[dict], int]:
    with open(path, "r", encoding="utf-8") as f:
        epds = json.load(f)["epds"]
    mapped = [m for m in (map_record(e) for e in epds) if m]
    return mapped, len(epds)


async def run_import(path: str):
    from sqlalchemy import select, func
    from app.database import AsyncSessionLocal
    from app.models.emission_factor import EmissionFactor
    from app.models.user import User

    mapped, total = load_mapped(path)
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            select(User.id).where(User.role == "admin")
            .order_by(User.created_at).limit(1))
        row = r.first()
        owner_id = row[0] if row else None
        if not owner_id:
            print("Warning: no admin user found — created_by_user_id will be NULL.")

        existing_refs = {
            ref for (ref,) in await db.execute(
                select(EmissionFactor.supplier_epd_reference)
                .where(EmissionFactor.supplier_epd_reference.is_not(None)))
        }
        existing_names = {
            n for (n,) in await db.execute(
                select(func.lower(EmissionFactor.activity_name)))
        }

        inserted = skipped_dup = skipped_err = 0
        for kw in mapped:
            if (kw["supplier_epd_reference"] in existing_refs
                    or kw["activity_name"].lower() in existing_names):
                skipped_dup += 1
                continue
            try:
                db.add(EmissionFactor(created_by_user_id=owner_id, **kw))
                existing_refs.add(kw["supplier_epd_reference"])
                existing_names.add(kw["activity_name"].lower())
                inserted += 1
            except Exception as e:  # noqa: BLE001 - record and continue
                skipped_err += 1
                print(f"  ! skip ({e}): {kw['activity_name'][:60]}")

        await db.commit()
        print(f"\nEPDs in file: {total} | importable: {len(mapped)}")
        print(f"Inserted: {inserted}")
        print(f"Skipped (already imported / duplicate name): {skipped_dup}")
        print(f"Skipped (errors): {skipped_err}")
        total_q = await db.execute(select(func.count()).select_from(EmissionFactor))
        print(f"Total rows in emission_factors now: {total_q.scalar()}")


def dry_run(path: str):
    mapped, total = load_mapped(path)
    normalised = sum(1 for m in mapped if m["ef_value"] != m["original_ef_value"])
    print(f"EPDs in file: {total}")
    print(f"Importable (GWP + declared unit + name): {len(mapped)}")
    print(f"  normalised to per-1-unit: {normalised}")
    print(f"  kept as-published basis : {len(mapped) - normalised}")
    from collections import Counter
    for unit, n in Counter(m["denominator_unit"] for m in mapped).most_common(8):
        print(f"  per {unit[:60]}: {n}")
    print("\nSample record:")
    sample = dict(mapped[0])
    sample["valid_from"] = str(sample["valid_from"])
    sample["valid_to"] = str(sample["valid_to"])
    print(json.dumps(sample, indent=2)[:1500])


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    path = args[0] if args else "/app/uploads/india_epds_enriched.json"
    if "--dry-run" in sys.argv:
        dry_run(path)
    else:
        import asyncio
        asyncio.run(run_import(path))
