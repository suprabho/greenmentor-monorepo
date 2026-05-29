"""Seed seven India emission factors used by the ls-ingestion bill extractor.

Usage (inside the backend container):
    python -m scripts.seed_india_factors <admin_email>

Idempotent — re-running only inserts rows whose activity_name + source
combination isn't already present.

These are the same values ls-ingestion used to carry as a hardcoded fallback.
Seeding them here lets ls-ingestion depend on EFDB for real.

Schema note: this targets the flat source schema introduced in migration
0002 (EmissionFactor with activity_name / ghg_scope / country_iso / ef_value
/ status ...). The `activity_name` strings deliberately contain the exact
substrings ls-ingestion searches for via `q` (see EFDB_QUERIES in
consulting/ls-ingestion/src/App.jsx) so the ILIKE lookup matches:
  electricity → "electricity purchased",  diesel → "diesel combustion",
  petrol → "petrol combustion",  CNG → "CNG combustion",
  LPG → "LPG combustion",  HSD → "HSD fuel oil combustion",
  coal → "coal combustion".
country_iso="IN" and ghg_scope match the country/scope the app sends.
"""
import asyncio
import sys
from datetime import date
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.emission_factor import EmissionFactor
from app.models.user import User
from app.services.embeddings import generate_embedding


# Mapped from the legacy target-schema seeds onto the flat source schema.
# `numerator_unit` / `denominator_unit` replace the old "kg CO2e / X" string;
# `ghg_scope` replaces applicable_scopes; `country_iso` + `geography_type`
# replace geography_country / geography_global.
SEEDS = [
    {
        "activity_name": "electricity purchased — India grid",
        "emission_category": "Purchased electricity",
        "ghg_scope": "2",
        "ef_value": 0.757,
        "denominator_unit": "kWh",
        "fuel_material_type": None,
        "combustion_type": None,
        "source_organization": "Central Electricity Authority (India)",
        "publication_title": "CO2 Baseline Database for the Indian Power Sector v20.0",
        "publication_year": 2024,
        "reference_year": 2024,
        "valid_from": date(2024, 4, 1),
        "valid_to": date(2025, 3, 31),
        "location_basis": "location-based",
    },
    {
        "activity_name": "diesel combustion — road/stationary",
        "emission_category": "Fuel combustion",
        "ghg_scope": "1",
        "ef_value": 2.68,
        "denominator_unit": "litre",
        "fuel_material_type": "diesel",
        "combustion_type": "stationary/mobile",
        "source_organization": "IPCC",
        "publication_title": "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
        "publication_year": 2006,
        "reference_year": 2006,
        "valid_from": date(2006, 1, 1),
        "valid_to": None,
        "location_basis": None,
    },
    {
        "activity_name": "petrol combustion",
        "emission_category": "Fuel combustion",
        "ghg_scope": "1",
        "ef_value": 2.31,
        "denominator_unit": "litre",
        "fuel_material_type": "petrol",
        "combustion_type": "mobile",
        "source_organization": "IPCC",
        "publication_title": "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
        "publication_year": 2006,
        "reference_year": 2006,
        "valid_from": date(2006, 1, 1),
        "valid_to": None,
        "location_basis": None,
    },
    {
        "activity_name": "CNG combustion — natural gas",
        "emission_category": "Fuel combustion",
        "ghg_scope": "1",
        "ef_value": 2.21,
        "denominator_unit": "kg",
        "fuel_material_type": "cng",
        "combustion_type": "stationary/mobile",
        "source_organization": "IPCC",
        "publication_title": "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
        "publication_year": 2006,
        "reference_year": 2006,
        "valid_from": date(2006, 1, 1),
        "valid_to": None,
        "location_basis": None,
    },
    {
        "activity_name": "LPG combustion",
        "emission_category": "Fuel combustion",
        "ghg_scope": "1",
        "ef_value": 1.611,
        "denominator_unit": "litre",
        "fuel_material_type": "lpg",
        "combustion_type": "stationary",
        "source_organization": "IPCC",
        "publication_title": "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
        "publication_year": 2006,
        "reference_year": 2006,
        "valid_from": date(2006, 1, 1),
        "valid_to": None,
        "location_basis": None,
    },
    {
        "activity_name": "HSD fuel oil combustion",
        "emission_category": "Fuel combustion",
        "ghg_scope": "1",
        "ef_value": 2.77,
        "denominator_unit": "litre",
        "fuel_material_type": "hsd",
        "combustion_type": "stationary",
        "source_organization": "IPCC",
        "publication_title": "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
        "publication_year": 2006,
        "reference_year": 2006,
        "valid_from": date(2006, 1, 1),
        "valid_to": None,
        "location_basis": None,
    },
    {
        "activity_name": "coal combustion — bituminous",
        "emission_category": "Fuel combustion",
        "ghg_scope": "1",
        "ef_value": 2.42,
        "denominator_unit": "kg",
        "fuel_material_type": "coal",
        "combustion_type": "stationary",
        "source_organization": "IPCC",
        "publication_title": "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
        "publication_year": 2006,
        "reference_year": 2006,
        "valid_from": date(2006, 1, 1),
        "valid_to": None,
        "location_basis": None,
    },
]


async def main(admin_email: str) -> None:
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(
            select(User).where(User.email == admin_email)
        )).scalar_one_or_none()
        if not admin:
            print(f"Admin user {admin_email} not found. Create one first with "
                  f"scripts.create_admin.", file=sys.stderr)
            sys.exit(1)

        inserted = 0
        already = 0
        for seed in SEEDS:
            existing = (await db.execute(
                select(EmissionFactor.id).where(and_(
                    EmissionFactor.activity_name == seed["activity_name"],
                    EmissionFactor.source_organization == seed["source_organization"],
                ))
            )).first()
            if existing:
                already += 1
                continue

            ef = EmissionFactor(
                # Identity
                activity_name=seed["activity_name"],
                emission_category=seed["emission_category"],
                ghg_scope=seed["ghg_scope"],
                # EF Value
                ef_value=seed["ef_value"],
                ghg_species="CO2e",
                expressed_as_co2e=True,
                ef_type="activity-based",
                # Units
                numerator_unit="kg CO2e",
                denominator_unit=seed["denominator_unit"],
                # Geography
                geography_type="country",
                country_iso="IN",
                location_basis=seed["location_basis"],
                # Technology
                fuel_material_type=seed["fuel_material_type"],
                combustion_type=seed["combustion_type"],
                # Temporal
                reference_year=seed["reference_year"],
                valid_from=seed["valid_from"],
                valid_to=seed["valid_to"],
                # Source
                source_organization=seed["source_organization"],
                publication_title=seed["publication_title"],
                publication_year=seed["publication_year"],
                data_origin="secondary",
                # Methodology
                calculation_method="activity-based",
                system_boundary="combustion only",
                # Operational
                status="active",
                name_embedding=await generate_embedding(seed["activity_name"]),
                created_by="seed-india-factors",
                created_by_user_id=admin.id,
            )
            db.add(ef)
            inserted += 1

        await db.commit()
        print(f"{inserted} inserted, {already} already present.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.seed_india_factors <admin_email>", file=sys.stderr)
        sys.exit(2)
    asyncio.run(main(sys.argv[1]))
