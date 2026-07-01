"""
Importer for the full EnvironDec library (data/environdec_epds_enriched.json)
into the EFDB emission_factors table as supplier-specific factors.

Generalises import_india_epds.py to the whole library: per-record geography
(GLO / ISO country / regional bloc) instead of hardcoded India, and it
generates the (zero-cost deterministic) name embedding at load time so semantic
search works immediately. Conflict detection is deferred (17k similar
construction products would flag noise — run a batch pass later if wanted).

One EF row per EPD: cradle-to-gate A1-A3 GWP as ef_value, scope 3 cat 1,
source_type "Supplier-provided / EPD". Dedup by supplier_epd_reference (and
lowercase activity_name) → SKIP, so re-runs are idempotent and the 388
existing India rows are left untouched.

Requires migration 0004 (supplier/source_type columns) to be applied.

Dry-run locally (no DB, stdlib + pycountry only):
    python3 scripts/import_environdec_epds.py ../data/environdec_epds_enriched.json --dry-run

Run against the DB (from backend/ with the venv; loads ../.env automatically):
    .venv/bin/python -m scripts.import_environdec_epds ../data/environdec_epds_enriched.json [--limit N]
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

# app.config reads its settings from env vars that live in consulting/efdb/.env
# (the parent of backend/). Load them before any `app.*` import happens.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

try:
    import pycountry
except ImportError:  # pragma: no cover - dry-run can still map GLO / regions
    pycountry = None

CREATED_BY = "environdec-bulk-import"
SOURCE_TYPE = "Supplier-provided / EPD"
SOURCE_DB = "International EPD System (environdec.com)"
COMMIT_EVERY = 500

SIMPLE_UNIT = re.compile(
    r"^(?P<amount>\d+(?:\.\d+)?)\s+(?P<unit>kg|t|tonne|m|m2|m3|pcs\.?|l|kWh)$", re.I
)

# ILCD / ecoinvent regional bloc codes -> human labels. Anything not here and
# not an ISO country falls back to using the raw code as region_name.
REGION_LABELS = {
    "RER": "Europe", "RoE": "Rest of Europe", "RNA": "North America",
    "RLA": "Latin America", "RAS": "Asia", "RAF": "Africa", "RME": "Middle East",
    "RoW": "Rest of World", "OCE": "Oceania", "NORD": "Nordic countries",
    "SEA": "South-East Asia", "RU": "Russia", "ENTSOE": "ENTSO-E (Europe)",
    "UCTE": "UCTE (Europe)", "GCC": "Gulf Cooperation Council",
}


def map_geo(code: str) -> tuple[str, str | None, str | None]:
    """Data Hub geo code -> (geography_type, country_iso(alpha-3), region_name)."""
    code = (code or "").strip()
    if not code or code.upper() == "GLO":
        return "global", None, None
    upper = code.upper()
    if upper in REGION_LABELS:
        return "regional", None, REGION_LABELS[upper]
    if pycountry:
        c = (pycountry.countries.get(alpha_2=upper)
             or pycountry.countries.get(alpha_3=upper))
        if c:
            return "national", c.alpha_3, None
    # Unknown multi-letter bloc code (e.g. "SAS", "RAU") — keep verbatim.
    return "regional", None, code


def map_record(epd: dict) -> dict | None:
    """Map one enriched EnvironDec EPD record to EmissionFactor kwargs (pure)."""
    gwp = epd.get("gwp_a1a3")
    declared_unit = (epd.get("declared_unit") or "").strip()
    name = (epd.get("product_name") or "").strip()
    manufacturer = (epd.get("manufacturer") or "").strip()
    reg = epd.get("registration_number")
    if gwp is None or not declared_unit or not name or not reg:
        return None

    m = SIMPLE_UNIT.match(declared_unit)
    if m:
        amount = float(m.group("amount"))
        denominator_unit = m.group("unit").rstrip(".")
        ef_value = gwp / amount if amount else gwp
    else:
        denominator_unit = declared_unit
        ef_value = gwp

    geography_type, country_iso, region_name = map_geo(epd.get("geo"))

    notes_bits = [
        f"Imported from EPD {reg} (International EPD System, environdec.com).",
        f"Indicator: {epd.get('gwp_a1a3_indicator') or 'GWP-GHG'}, modules A1-A3, "
        f"as published: {gwp:g} {epd.get('gwp_unit') or 'kg CO2 eq.'} per {declared_unit}.",
    ]
    if epd.get("gwp_fossil_a1a3") is not None:
        notes_bits.append(f"GWP-fossil A1-A3: {epd['gwp_fossil_a1a3']:g}.")
    if epd.get("gwp_biogenic_a1a3") is not None:
        notes_bits.append(f"GWP-biogenic A1-A3: {epd['gwp_biogenic_a1a3']:g}.")
    if epd.get("gwp_total_modules"):
        mods = {k: v for k, v in epd["gwp_total_modules"].items() if v is not None}
        if mods:
            notes_bits.append("GWP-total per module: "
                              + ", ".join(f"{k}={v:g}" for k, v in mods.items()) + ".")
    if epd.get("life_cycle_stages"):
        notes_bits.append(f"Declared modules: {epd['life_cycle_stages']}.")
    if epd.get("compliance"):
        notes_bits.append("Compliance: " + ", ".join(epd["compliance"]) + ".")
    if epd.get("uuid"):
        notes_bits.append(f"Data Hub uuid: {epd['uuid']}.")

    ref_year = epd.get("ref_year")
    valid_from = date(ref_year, 1, 1) if ref_year else None
    valid_to = date(epd["valid_until_year"], 12, 31) if epd.get("valid_until_year") else None
    reference_year = ref_year or (valid_to.year if valid_to else date.today().year)

    # avoid "Product by Acme — Acme" when the title already names the maker
    mfr_token = re.sub(r"\b(inc|corp|co|ltd|limited|gmbh|ab|as|sa|srl|llc|bv|pvt)\b\.?",
                       "", manufacturer, flags=re.I).strip(" .,")
    if mfr_token and mfr_token.lower() in name.lower():
        activity_name = name
    elif manufacturer:
        activity_name = f"{name} — {manufacturer}"
    else:
        activity_name = name

    return dict(
        activity_name=activity_name,
        activity_description=(
            f"Supplier-specific cradle-to-gate (A1-A3) factor from the EPD for "
            f"{name}{' by ' + manufacturer if manufacturer else ''}."
        ),
        emission_category="material",
        sub_category=epd.get("classification"),
        ghg_scope="3",
        scope3_category="1: Purchased goods & services",
        ef_value=ef_value,
        ghg_species="CO2e",
        expressed_as_co2e=True,
        ef_type="activity-based",
        numerator_unit="kg CO2e",
        denominator_unit=denominator_unit,
        denominator_basis=f"declared unit: {declared_unit}",
        gwp_basis="GWP100",
        geography_type=geography_type,
        country_iso=country_iso,
        region_name=region_name,
        reference_year=reference_year,
        valid_from=valid_from,
        valid_to=valid_to,
        ef_version=reg.split(":")[-1],
        source_organization=manufacturer or "Unknown",
        source_database=SOURCE_DB,
        publication_title=f"EPD: {name}",
        publication_year=reference_year,
        source_url=epd.get("epd_url"),
        original_ef_value=gwp,
        original_unit=f"{epd.get('gwp_unit') or 'kg CO2 eq.'} / {declared_unit}",
        data_origin="primary",
        calculation_method="supplier-specific",
        system_boundary="cradle-to-gate",
        includes_biogenic_co2=epd.get("gwp_biogenic_a1a3") is not None,
        third_party_verified=True,  # ISO 14025 EPDs are independently verified
        status="active",
        sector_tags=[epd["classification"]] if epd.get("classification") else None,
        notes=" ".join(notes_bits),
        source_type=SOURCE_TYPE,
        supplier_name=manufacturer or None,
        supplier_country=country_iso,
        supplier_sector=epd.get("classification"),
        supplier_epd_reference=reg,
        created_by=CREATED_BY,
    )


def load_mapped(path: str) -> tuple[list[dict], int]:
    with open(path, "r", encoding="utf-8") as f:
        epds = json.load(f)["epds"]
    mapped = [m for m in (map_record(e) for e in epds) if m]
    return mapped, len(epds)


async def run_import(path: str, limit: int | None = None):
    from sqlalchemy import select, func
    from app.database import AsyncSessionLocal
    from app.models.emission_factor import EmissionFactor
    from app.models.user import User
    from app.services.embeddings import generate_embedding

    mapped, total = load_mapped(path)
    if limit:
        mapped = mapped[:limit]

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
        pending = 0
        for kw in mapped:
            if (kw["supplier_epd_reference"] in existing_refs
                    or kw["activity_name"].lower() in existing_names):
                skipped_dup += 1
                continue
            try:
                kw["name_embedding"] = await generate_embedding(kw["activity_name"])
                db.add(EmissionFactor(created_by_user_id=owner_id, **kw))
                existing_refs.add(kw["supplier_epd_reference"])
                existing_names.add(kw["activity_name"].lower())
                inserted += 1
                pending += 1
                if pending >= COMMIT_EVERY:
                    await db.commit()
                    pending = 0
                    print(f"  committed {inserted} so far...", flush=True)
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
    from collections import Counter
    mapped, total = load_mapped(path)
    normalised = sum(1 for m in mapped if m["ef_value"] != m["original_ef_value"])
    print(f"EPDs in file: {total}")
    print(f"Importable (GWP + declared unit + name + reg): {len(mapped)}")
    print(f"  normalised to per-1-unit: {normalised}")
    print(f"  kept as-published basis : {len(mapped) - normalised}")
    print("\nGeography type distribution:")
    for gt, n in Counter(m["geography_type"] for m in mapped).most_common():
        print(f"  {gt}: {n}")
    print("\nTop countries (alpha-3):")
    for iso, n in Counter(m["country_iso"] for m in mapped if m["country_iso"]).most_common(10):
        print(f"  {iso}: {n}")
    print("\nTop denominator units:")
    for unit, n in Counter(m["denominator_unit"] for m in mapped).most_common(8):
        print(f"  per {unit[:50]}: {n}")
    print("\nSample record:")
    sample = dict(mapped[0])
    sample["valid_from"] = str(sample["valid_from"])
    sample["valid_to"] = str(sample["valid_to"])
    print(json.dumps(sample, indent=2)[:1600])


if __name__ == "__main__":
    raw = sys.argv[1:]
    limit = None
    if "--limit" in raw:
        i = raw.index("--limit")
        limit = int(raw[i + 1])
        del raw[i:i + 2]
    args = [a for a in raw if a != "--dry-run"]
    path = args[0] if args else "../data/environdec_epds_enriched.json"
    if "--dry-run" in sys.argv:
        dry_run(path)
    else:
        import asyncio
        asyncio.run(run_import(path, limit))
