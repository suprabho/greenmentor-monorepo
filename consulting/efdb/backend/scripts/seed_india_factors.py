"""Seed seven India emission factors used by the ls-ingestion bill extractor.

Usage (inside the backend container):
    python -m scripts.seed_india_factors <admin_email>

Idempotent — re-running will only insert rows that don't already exist
(matched by canonical_activity_name + source_name).

These are the same values ls-ingestion used to carry as a hardcoded fallback.
Seeding them here lets ls-ingestion drop the fallback and depend on EFDB for real.

Implementation note: the existing `sourcetype` Postgres enum was created with
human-readable LABELS (e.g. `"Government / Regulatory body"`) — see the alembic
migration at migrations/versions/0001_initial.py. But the model uses
`SAEnum(SourceType)` without `values_callable`, so SQLAlchemy binds the Python
member NAME (e.g. `"government"`) which Postgres rejects. To avoid widening
scope by changing the model (and possibly breaking the ingestion path that
also relies on the current behaviour), this script writes via raw SQL with
explicit enum casts.
"""
import asyncio
import json
import sys
import uuid
from datetime import date
from sqlalchemy import select, and_, text
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.emission_factor import EmissionFactor, SourceType, GWPVersion
from app.models.confidence_config import ConfidenceWeightConfig
from app.services.confidence_score import calculate_confidence
from app.services.embeddings import generate_embedding


# Verbatim from ls-ingestion App.jsx EFDB_FALLBACK (consulting/ls-ingestion/src/App.jsx:171).
# Validity window kept wide so recency scoring stays meaningful.
SEEDS = [
    {
        "canonical_activity_name": "electricity purchased — India grid",
        "source_activity_name": "Grid electricity purchased",
        "activity_category": "Energy > Electricity > Purchased grid electricity",
        "unit": "kg CO2e / kWh",
        "ef_total_co2e": 0.757,
        "applicable_scopes": ["Scope 2"],
        "source_name": "CEA CO2 Baseline v20.0 Dec 2024",
        "source_type": SourceType.government,
        "validity_start": date(2024, 4, 1),
        "validity_end": date(2025, 3, 31),
    },
    {
        "canonical_activity_name": "diesel combustion — road/stationary",
        "source_activity_name": "Diesel combustion",
        "activity_category": "Fuel combustion > Liquid fuels > Diesel",
        "unit": "kg CO2e / litre",
        "ef_total_co2e": 2.68,
        "applicable_scopes": ["Scope 1"],
        "source_name": "IPCC 2006 Guidelines",
        "source_type": SourceType.intergovernmental,
        "validity_start": date(2006, 1, 1),
        "validity_end": None,
    },
    {
        "canonical_activity_name": "petrol combustion",
        "source_activity_name": "Petrol (gasoline) combustion",
        "activity_category": "Fuel combustion > Liquid fuels > Petrol",
        "unit": "kg CO2e / litre",
        "ef_total_co2e": 2.31,
        "applicable_scopes": ["Scope 1"],
        "source_name": "IPCC 2006 Guidelines",
        "source_type": SourceType.intergovernmental,
        "validity_start": date(2006, 1, 1),
        "validity_end": None,
    },
    {
        "canonical_activity_name": "CNG combustion — natural gas",
        "source_activity_name": "Compressed natural gas combustion",
        "activity_category": "Fuel combustion > Gaseous fuels > CNG",
        "unit": "kg CO2e / kg",
        "ef_total_co2e": 2.21,
        "applicable_scopes": ["Scope 1"],
        "source_name": "IPCC 2006 Guidelines",
        "source_type": SourceType.intergovernmental,
        "validity_start": date(2006, 1, 1),
        "validity_end": None,
    },
    {
        "canonical_activity_name": "LPG combustion",
        "source_activity_name": "Liquefied petroleum gas combustion",
        "activity_category": "Fuel combustion > Gaseous fuels > LPG",
        "unit": "kg CO2e / litre",
        "ef_total_co2e": 1.611,
        "applicable_scopes": ["Scope 1"],
        "source_name": "IPCC 2006 Guidelines",
        "source_type": SourceType.intergovernmental,
        "validity_start": date(2006, 1, 1),
        "validity_end": None,
    },
    {
        "canonical_activity_name": "HSD fuel oil combustion",
        "source_activity_name": "High-speed diesel combustion",
        "activity_category": "Fuel combustion > Liquid fuels > HSD",
        "unit": "kg CO2e / litre",
        "ef_total_co2e": 2.77,
        "applicable_scopes": ["Scope 1"],
        "source_name": "IPCC 2006 Guidelines",
        "source_type": SourceType.intergovernmental,
        "validity_start": date(2006, 1, 1),
        "validity_end": None,
    },
    {
        "canonical_activity_name": "coal combustion — bituminous",
        "source_activity_name": "Bituminous coal combustion",
        "activity_category": "Fuel combustion > Solid fuels > Coal",
        "unit": "kg CO2e / kg",
        "ef_total_co2e": 2.42,
        "applicable_scopes": ["Scope 1"],
        "source_name": "IPCC 2006 Guidelines",
        "source_type": SourceType.intergovernmental,
        "validity_start": date(2006, 1, 1),
        "validity_end": None,
    },
]


INSERT_SQL = text("""
INSERT INTO efdb.emission_factors (
    id, version_number, is_current, is_superseded, has_conflict, migrated,
    source_activity_name, canonical_activity_name, activity_category, unit,
    ef_total_co2e, applicable_scopes,
    source_name, source_type,
    validity_start, validity_end,
    geography_global, geography_country,
    confidence_score, confidence_breakdown, gwp_version,
    custom_tags, name_embedding,
    created_by, created_at
) VALUES (
    :id, 1, true, false, false, true,
    :source_activity_name, :canonical_activity_name, :activity_category, :unit,
    :ef_total_co2e, CAST(:applicable_scopes AS json),
    :source_name, CAST(:source_type AS efdb.sourcetype),
    :validity_start, :validity_end,
    false, 'IN',
    :confidence_score, CAST(:confidence_breakdown AS json), CAST(:gwp_version AS efdb.gwpversion),
    CAST(:custom_tags AS json), CAST(:name_embedding AS vector),
    :created_by, NOW()
)
""")


async def main(admin_email: str) -> None:
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.email == admin_email))).scalar_one_or_none()
        if not admin:
            print(f"Admin user {admin_email} not found. Create one first with scripts.create_admin.", file=sys.stderr)
            sys.exit(1)

        weights = ConfidenceWeightConfig.default_weights()

        inserted = 0
        already = 0
        for seed in SEEDS:
            existing = (await db.execute(
                select(EmissionFactor.id).where(and_(
                    EmissionFactor.canonical_activity_name == seed["canonical_activity_name"],
                    EmissionFactor.source_name == seed["source_name"],
                ))
            )).first()
            if existing:
                already += 1
                continue

            # Build a transient ORM instance only to feed calculate_confidence
            # (it expects an EmissionFactor-shaped object).
            scoring_ef = EmissionFactor(
                source_activity_name=seed["source_activity_name"],
                canonical_activity_name=seed["canonical_activity_name"],
                unit=seed["unit"],
                source_type=seed["source_type"],
                gwp_version=GWPVersion.ar5,
                geography_country="IN",
                geography_global=False,
                validity_start=seed["validity_start"],
                validity_end=seed["validity_end"],
                created_by=admin.id,
            )
            score, breakdown = calculate_confidence(scoring_ef, weights)
            embedding = await generate_embedding(seed["canonical_activity_name"])

            await db.execute(INSERT_SQL, {
                "id": uuid.uuid4(),
                "source_activity_name": seed["source_activity_name"],
                "canonical_activity_name": seed["canonical_activity_name"],
                "activity_category": seed["activity_category"],
                "unit": seed["unit"],
                "ef_total_co2e": seed["ef_total_co2e"],
                "applicable_scopes": json.dumps(seed["applicable_scopes"]),
                "source_name": seed["source_name"],
                "source_type": seed["source_type"].value,
                "validity_start": seed["validity_start"],
                "validity_end": seed["validity_end"],
                "confidence_score": score,
                "confidence_breakdown": json.dumps(breakdown),
                "gwp_version": GWPVersion.ar5.value,
                "custom_tags": json.dumps([]),
                "name_embedding": "[" + ",".join(str(x) for x in embedding) + "]",
                "created_by": admin.id,
            })
            inserted += 1

        await db.commit()
        print(f"{inserted} inserted, {already} already present.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.seed_india_factors <admin_email>", file=sys.stderr)
        sys.exit(2)
    asyncio.run(main(sys.argv[1]))
