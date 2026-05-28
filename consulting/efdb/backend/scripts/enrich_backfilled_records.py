"""
AI-assisted enrichment of the 7 pre-source-schema-backfill rows.

For each row whose `created_by = 'pre-source-schema-backfill'`, call Claude
with the current (partial) record plus the source-schema field reference
and ask it to return a JSON patch containing ONLY fields it is highly
confident about (typically: fuel_material_type, combustion_type, vehicle_type,
end_use_sector, system_boundary, calculation_method, data_origin,
includes_biogenic_co2, includes_land_use_change, upstream_included,
source_database, publication_title, publication_year, source_url,
dq_score_overall, dq_geographic_rep, dq_temporal_rep, dq_tech_rep,
third_party_verified, framework_tags, sector_tags).

Claude is explicitly told NOT to touch the ef_value, activity_name,
ghg_species, country_iso, reference_year, valid_from/to, or
source_organization — those came directly from the prior database and
must remain authoritative.

Usage (inside the backend container):
    docker exec efdb-backend-1 python -m scripts.enrich_backfilled_records           # dry-run
    docker exec efdb-backend-1 python -m scripts.enrich_backfilled_records --apply   # commit
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from sqlalchemy import select, update
import anthropic

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.emission_factor import EmissionFactor
from app.models.audit_log import AuditLog, AuditAction


# Fields Claude is allowed to propose values for. Anything outside this set
# is silently dropped from the patch — even if Claude returns it. This is
# the safety net against the model rewriting the EF value itself.
ENRICHABLE_FIELDS = {
    # Technology
    "fuel_material_type", "technology_descriptor", "vehicle_type",
    "end_use_sector", "combustion_type", "carbon_content_fraction",
    # Methodology
    "calculation_method", "system_boundary",
    "includes_biogenic_co2", "includes_land_use_change",
    "allocation_method", "upstream_included",
    # Source publication details
    "source_database", "publication_title", "publication_year",
    "source_url", "original_ef_value", "original_unit", "data_origin",
    "ef_type", "ef_version", "update_frequency",
    # DQ
    "uncertainty_pct", "uncertainty_method",
    "dq_score_overall", "dq_geographic_rep",
    "dq_temporal_rep", "dq_tech_rep", "third_party_verified",
    # Identity additions
    "activity_description", "activity_code",
    "scope3_category", "activity_level",
    "sub_category",
    # Operational tags
    "framework_tags", "sector_tags", "is_default_ef",
    # Units
    "denominator_basis", "unit_notes",
    # Geography
    "grid_zone_id", "location_basis", "region_name",
    # GWP
    "gwp_value_used",
}

# Fields Claude must never overwrite, even if returned in the patch.
LOCKED_FIELDS = {
    "id", "ef_id", "version_number",
    "activity_name",
    "ef_value", "ghg_species", "expressed_as_co2e",
    "ghg_scope", "gwp_basis", "emission_category",
    "numerator_unit", "denominator_unit",
    "geography_type", "country_iso",
    "reference_year", "valid_from", "valid_to",
    "source_organization",
    "status", "superseded_by_ef_id", "superseded_reason",
    "created_at", "updated_at", "created_by",
    "created_by_user_id", "last_edited_by_user_id", "last_edited_at",
    "has_conflict", "source_document_id", "extraction_session_id",
    "name_embedding", "notes",
}


SYSTEM_PROMPT = """You are a GHG emission factor metadata enrichment specialist.

You will be given an existing emission factor record from a database. Its
core values (activity_name, ef_value, ghg_species, country_iso, units,
reference_year, source_organization) are AUTHORITATIVE — do not propose
changes to them. They came from a verified source.

What you must do: produce a JSON object containing ONLY the fields you
can fill in with high confidence based on the activity_name +
source_organization + ghg_species + reference year. Leave any field you
are uncertain about OUT of the response (do NOT include it as null;
simply omit it). Quality > coverage. A field is "high confidence" when
you can name the specific source (e.g. "IPCC 2006 Guidelines Vol 2, Ch 2,
Table 2.2" → publication_title) or when the value is industry-standard
practice (e.g. fossil-fuel combustion factors have
includes_biogenic_co2=false).

You are particularly good at filling:
  - fuel_material_type: free text, e.g. "diesel", "petrol", "natural gas",
    "LPG", "high-speed diesel", "bituminous coal"
  - combustion_type: "stationary" | "mobile" | "fugitive" | "process"
  - vehicle_type: only when relevant, e.g. "passenger car", "HGV"
  - end_use_sector: "transport" | "residential" | "commercial" |
    "industry" | "power generation"
  - system_boundary: combustion factors → "tank-to-wheel" for vehicles or
    "combustion-only"; CEA grid factor → "generation-to-grid". Be precise.
  - calculation_method: "fuel-based" | "activity-based" | "spend-based"
  - data_origin: "primary" if the publisher measured it themselves,
    "secondary" if cited from another dataset
  - includes_biogenic_co2: false for fossil fuels; true if blended with
    biofuel
  - includes_land_use_change: false for combustion factors
  - upstream_included: false for tailpipe / combustion factors
  - source_database: e.g. "IPCC 2006 Guidelines for National Greenhouse
    Gas Inventories", "CEA CO2 Baseline Database for the Indian Power Sector"
  - publication_title: full publication name
  - publication_year: integer year of the cited publication
  - source_url: the canonical landing URL only if you are confident it is
    stable (IPCC and CEA publish stable URLs)
  - dq_score_overall: 1-5 (1=best). IPCC defaults for fossil-fuel
    combustion are typically 2-3 (international standard, regional fit
    varies). CEA grid factor for India 2024 reference year applied in
    India is typically 1-2.
  - dq_geographic_rep, dq_temporal_rep, dq_tech_rep: 1-5 each.
  - third_party_verified: true for IPCC / CEA / EPA / DESNZ; false for
    internal estimates.
  - framework_tags: short uppercase tokens, e.g. ["GHGP", "ISO14064",
    "IPCC2006"]
  - sector_tags: lowercase, e.g. ["energy", "transport", "power"]
  - ef_type: "activity-based" for most factors; "intensity" only when
    expressed per output (e.g. kg CO2e / GBP). Leave as is unless certain.

Return a single JSON object via the propose_enrichment tool. No prose."""


ENRICHMENT_TOOL = {
    "name": "propose_enrichment",
    "description": (
        "Submit the enrichment patch for an emission factor record. "
        "Include only fields you can fill with high confidence. Omit any "
        "field you are uncertain about."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": (
                    "1-3 sentences explaining the source you are drawing on "
                    "(e.g. 'IPCC 2006 Vol 2 Ch 2 Table 2.2 stationary combustion default')."
                ),
            },
            "patch": {
                "type": "object",
                "description": "The enrichment fields. Keys MUST be source-schema column names.",
                "additionalProperties": True,
            },
            "confidence": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "Overall confidence in this patch.",
            },
        },
        "required": ["reasoning", "patch", "confidence"],
    },
}


def _row_to_context(ef: EmissionFactor) -> dict:
    """Compact JSON snapshot of the row for Claude to read."""
    return {
        "id": str(ef.id),
        "ef_id": ef.ef_id,
        "activity_name": ef.activity_name,
        "ef_value": ef.ef_value,
        "ghg_species": ef.ghg_species,
        "expressed_as_co2e": ef.expressed_as_co2e,
        "gwp_basis": ef.gwp_basis,
        "numerator_unit": ef.numerator_unit,
        "denominator_unit": ef.denominator_unit,
        "emission_category": ef.emission_category,
        "sub_category": ef.sub_category,
        "ghg_scope": ef.ghg_scope,
        "country_iso": ef.country_iso,
        "geography_type": ef.geography_type,
        "reference_year": ef.reference_year,
        "valid_from": str(ef.valid_from) if ef.valid_from else None,
        "valid_to": str(ef.valid_to) if ef.valid_to else None,
        "source_organization": ef.source_organization,
        "status": ef.status,
        "notes": ef.notes,
        # what's currently null (so Claude knows what's missing):
        "currently_null_fields": [
            k for k in sorted(ENRICHABLE_FIELDS) if getattr(ef, k, None) in (None, "", [])
        ],
    }


async def _enrich_one(ef: EmissionFactor, client: anthropic.AsyncAnthropic) -> dict | None:
    """Call Claude for one row, return the validated patch + meta."""
    context = _row_to_context(ef)
    user_msg = (
        "Here is the existing record. Propose an enrichment patch using the "
        "propose_enrichment tool.\n\n"
        + json.dumps(context, indent=2, default=str)
    )

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        tools=[ENRICHMENT_TOOL],
        tool_choice={"type": "tool", "name": "propose_enrichment"},
        messages=[{"role": "user", "content": user_msg}],
    )

    tool_use = next((b for b in response.content if b.type == "tool_use"), None)
    if not tool_use:
        return None
    inp = tool_use.input or {}
    raw_patch = (inp.get("patch") or {})

    # Filter: only keep keys in ENRICHABLE_FIELDS AND not in LOCKED_FIELDS.
    clean_patch = {
        k: v for k, v in raw_patch.items()
        if k in ENRICHABLE_FIELDS and k not in LOCKED_FIELDS and v not in (None, "", [])
    }
    return {
        "id": str(ef.id),
        "activity_name": ef.activity_name,
        "source_organization": ef.source_organization,
        "reasoning": inp.get("reasoning"),
        "confidence": inp.get("confidence"),
        "raw_patch_keys": sorted(raw_patch.keys()),
        "rejected_keys": sorted(set(raw_patch) - set(clean_patch)),
        "patch": clean_patch,
    }


async def main(apply: bool, from_file: str | None):
    proposals: list[dict] = []

    if from_file:
        # Read pre-reviewed/edited proposals from disk; skip Claude entirely.
        with open(from_file) as f:
            proposals = json.load(f)
        # Re-filter every patch through the safety net in case the file was edited.
        for p in proposals:
            p["patch"] = {
                k: v for k, v in (p.get("patch") or {}).items()
                if k in ENRICHABLE_FIELDS and k not in LOCKED_FIELDS and v not in (None, "", [])
            }
        print(f"Loaded {len(proposals)} proposals from {from_file}.\n")
    else:
        if not settings.anthropic_api_key:
            print("ANTHROPIC_API_KEY missing.", file=sys.stderr)
            sys.exit(1)
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(EmissionFactor).where(EmissionFactor.created_by == "pre-source-schema-backfill")
                .order_by(EmissionFactor.activity_name)
            )).scalars().all()
            if not rows:
                print("No backfilled rows found.")
                return
            print(f"Found {len(rows)} backfilled rows.\n")

            for ef in rows:
                print(f"→ {ef.activity_name} [{ef.source_organization}] …", flush=True)
                try:
                    result = await _enrich_one(ef, client)
                except Exception as e:
                    print(f"  ! Claude error: {e}")
                    continue
                if not result:
                    print("  ! no tool_use in response")
                    continue
                proposals.append(result)
                patch_summary = ", ".join(f"{k}={json.dumps(v)[:40]}" for k, v in result["patch"].items())
                print(f"  confidence: {result['confidence']}")
                print(f"  patch ({len(result['patch'])} fields): {patch_summary[:200]}")
                if result["rejected_keys"]:
                    print(f"  dropped (not in enrichable set): {result['rejected_keys']}")
                print(f"  reasoning: {result['reasoning']}\n")

        print(f"\n{'=' * 60}")
        print(f"Total proposals: {len(proposals)}")
        if not apply:
            print("\nDRY-RUN. Re-run with --apply to commit these patches.")
            out_path = "/app/uploads/enrichment_proposals.json"
            with open(out_path, "w") as f:
                json.dump(proposals, f, indent=2, default=str)
            print(f"Full proposals written to {out_path}")
            return

    # Apply path — uses a fresh session in case the read above was on a closed one.
    print("\nApplying patches…")
    async with AsyncSessionLocal() as db:
        applied = 0
        for p in proposals:
            if not p.get("patch"):
                continue
            ef_id = p["id"]
            ef = (await db.execute(select(EmissionFactor).where(EmissionFactor.id == ef_id))).scalar_one()
            for k, v in p["patch"].items():
                setattr(ef, k, v)
            ef.version_number += 1
            ef.last_edited_at = datetime.now(timezone.utc)
            db.add(AuditLog(
                action=AuditAction.record_edited,
                emission_factor_id=ef.id,
                details={
                    "source": "ai-enrichment",
                    "reasoning": p.get("reasoning"),
                    "confidence": p.get("confidence"),
                    "patch": p["patch"],
                    "rejected_keys": p.get("rejected_keys", []),
                },
            ))
            applied += 1
        await db.commit()
        print(f"Applied {applied} patches.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Commit the patches to the DB (default: dry-run).")
    parser.add_argument("--from-file", default=None,
                        help="Skip Claude and apply pre-reviewed proposals from this JSON file.")
    args = parser.parse_args()
    asyncio.run(main(args.apply, args.from_file))
