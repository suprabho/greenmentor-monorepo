"""
AI Chat agent for emission factor recommendations.

Uses Claude with tool-calling to search the database, then reasons over
the results to produce a ranked recommendation with full explanation.
"""
import json
from typing import AsyncIterator
from datetime import date
import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text
from app.config import settings
from app.models.emission_factor import EmissionFactor
from app.services.extraction.prompts import CHAT_SYSTEM_PROMPT
from app.services.embeddings import generate_embedding

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

SEARCH_TOOL = {
    "name": "search_emission_factors",
    "description": (
        "Search the emission factor database. Returns up to 10 candidate records "
        "ranked by semantic relevance to the activity query and (when set) by "
        "the dq_score_overall pedigree score (1 best → 5 worst). Always call "
        "this tool before answering."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "activity_query": {
                "type": "string",
                "description": (
                    "The activity / material / fuel to search for "
                    "(e.g., 'diesel road freight', 'natural gas combustion')"
                ),
            },
            "country_iso": {
                "type": "string",
                "description": (
                    "ISO 3166-1 alpha-3 country code (e.g., 'IND', 'USA', 'GBR'). "
                    "Pass 'GLOBAL' or omit to match worldwide factors."
                ),
            },
            "year": {
                "type": "integer",
                "description": "Reference year or year the factor should be valid for",
            },
            "ghg_scope": {
                "type": "string",
                "description": "GHG Protocol scope: '1', '2', or '3'",
                "enum": ["1", "2", "3"],
            },
            "ghg_species": {
                "type": "string",
                "description": "Filter by gas species: CO2, CO2e, CH4, N2O, etc.",
            },
            "emission_category": {
                "type": "string",
                "description": "Optional category filter (e.g., 'energy', 'transport', 'material')",
            },
            "source_organization": {
                "type": "string",
                "description": "Filter by data publisher (e.g., 'US EPA', 'BEIS / DESNZ', 'IEA')",
            },
            "gwp_basis": {
                "type": "string",
                "description": "GWP version (e.g., 'AR6', 'AR5')",
            },
            "max_dq_score": {
                "type": "integer",
                "description": "Maximum pedigree DQ score to include (1=best, 5=worst). Omit for no filter.",
                "minimum": 1,
                "maximum": 5,
            },
        },
        "required": ["activity_query"],
    },
}


async def _search_database(
    activity_query: str,
    country_iso: str | None,
    year: int | None,
    ghg_scope: str | None,
    ghg_species: str | None,
    emission_category: str | None,
    source_organization: str | None,
    gwp_basis: str | None,
    max_dq_score: int | None,
    db: AsyncSession,
) -> list[dict]:
    """Execute the database search and return serialisable results."""
    conditions = [EmissionFactor.status == "active"]
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
    if country_iso and country_iso.upper() not in ("GLOBAL", ""):
        conditions.append(
            or_(EmissionFactor.country_iso == country_iso.upper()[:3],
                EmissionFactor.geography_type == "global")
        )
    if ghg_scope:
        conditions.append(EmissionFactor.ghg_scope == ghg_scope)
    if ghg_species:
        conditions.append(EmissionFactor.ghg_species.ilike(ghg_species))
    if emission_category:
        conditions.append(EmissionFactor.emission_category.ilike(emission_category))
    if source_organization:
        conditions.append(EmissionFactor.source_organization.ilike(f"%{source_organization}%"))
    if gwp_basis:
        conditions.append(EmissionFactor.gwp_basis.ilike(gwp_basis))
    if max_dq_score is not None:
        conditions.append(EmissionFactor.dq_score_overall <= max_dq_score)

    embedding = await generate_embedding(activity_query)
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    try:
        result = await db.execute(
            select(EmissionFactor)
            .where(and_(*conditions, EmissionFactor.name_embedding != None))
            .order_by(text(f"name_embedding <=> '{embedding_str}'"))
            .limit(10)
        )
        records = result.scalars().all()
    except Exception:
        records = []

    if not records:
        result = await db.execute(
            select(EmissionFactor)
            .where(and_(*conditions))
            .where(EmissionFactor.activity_name.ilike(f"%{activity_query}%"))
            .order_by(EmissionFactor.dq_score_overall.asc().nullslast(),
                      EmissionFactor.reference_year.desc())
            .limit(10)
        )
        records = result.scalars().all()

    return [_serialize_ef(ef) for ef in records]


def _serialize_ef(ef: EmissionFactor) -> dict:
    return {
        "id": str(ef.id),
        "ef_id": ef.ef_id,
        "activity_name": ef.activity_name,
        "activity_description": ef.activity_description,
        "emission_category": ef.emission_category,
        "sub_category": ef.sub_category,
        "ghg_scope": ef.ghg_scope,
        "scope3_category": ef.scope3_category,
        "ef_value": ef.ef_value,
        "ghg_species": ef.ghg_species,
        "expressed_as_co2e": ef.expressed_as_co2e,
        "gwp_basis": ef.gwp_basis,
        "ef_type": ef.ef_type,
        "numerator_unit": ef.numerator_unit,
        "denominator_unit": ef.denominator_unit,
        "unit": f"{ef.numerator_unit} / {ef.denominator_unit}",
        "geography_type": ef.geography_type,
        "country_iso": ef.country_iso,
        "region_name": ef.region_name,
        "reference_year": ef.reference_year,
        "valid_from": str(ef.valid_from) if ef.valid_from else None,
        "valid_to": str(ef.valid_to) if ef.valid_to else None,
        "source_organization": ef.source_organization,
        "source_database": ef.source_database,
        "publication_title": ef.publication_title,
        "publication_year": ef.publication_year,
        "source_url": ef.source_url,
        "data_origin": ef.data_origin,
        "calculation_method": ef.calculation_method,
        "system_boundary": ef.system_boundary,
        "dq_score_overall": ef.dq_score_overall,
        "uncertainty_pct": ef.uncertainty_pct,
        "status": ef.status,
        "has_conflict": ef.has_conflict,
        "notes": ef.notes,
    }


async def run_chat(
    messages: list[dict],
    min_confidence: int,  # legacy param; ignored (kept for ABI compat)
    db: AsyncSession,
) -> AsyncIterator[str]:
    """
    Run the chat agent with tool-calling and stream the response.
    Yields text chunks as Claude produces them.
    """
    tools = [SEARCH_TOOL]
    current_messages = list(messages)
    max_iterations = 5

    for _ in range(max_iterations):
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=CHAT_SYSTEM_PROMPT,
            tools=tools,
            messages=current_messages,
        )

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if tool_uses:
            tool_results = []
            for tool_use in tool_uses:
                if tool_use.name == "search_emission_factors":
                    inp = tool_use.input
                    results = await _search_database(
                        activity_query=inp.get("activity_query", ""),
                        country_iso=inp.get("country_iso"),
                        year=inp.get("year"),
                        ghg_scope=inp.get("ghg_scope"),
                        ghg_species=inp.get("ghg_species"),
                        emission_category=inp.get("emission_category"),
                        source_organization=inp.get("source_organization"),
                        gwp_basis=inp.get("gwp_basis"),
                        max_dq_score=inp.get("max_dq_score"),
                        db=db,
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": json.dumps(results, indent=2, default=str),
                    })

            current_messages.append({"role": "assistant", "content": response.content})
            current_messages.append({"role": "user", "content": tool_results})

        elif response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    yield block.text
            return
        else:
            for block in response.content:
                if hasattr(block, "text"):
                    yield block.text
            return

    yield "I reached the maximum number of search iterations. Please try a more specific query."
