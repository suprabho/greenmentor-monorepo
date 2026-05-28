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
from sqlalchemy import select, and_, or_, func, text
from app.config import settings
from app.models.emission_factor import EmissionFactor
from app.services.extraction.prompts import CHAT_SYSTEM_PROMPT
from app.services.embeddings import generate_embedding

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

SEARCH_TOOL = {
    "name": "search_emission_factors",
    "description": (
        "Search the emission factor database. Returns up to 10 candidate records "
        "ranked by relevance and confidence score. Always call this before answering."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "activity_query": {
                "type": "string",
                "description": "The activity, material, or item to search for (e.g., 'diesel road freight', 'natural gas combustion')",
            },
            "geography": {
                "type": "string",
                "description": "ISO 3166-1 alpha-2 country code (e.g., 'IN', 'US', 'GB') or 'Global'",
            },
            "year": {
                "type": "integer",
                "description": "The year the emission factor should be valid for",
            },
            "scope": {
                "type": "string",
                "description": "GHG Protocol scope (e.g., 'Scope 1', 'Scope 3 — Category 4: Upstream transportation & distribution')",
            },
            "gwp_version": {
                "type": "string",
                "description": "GWP version preference (e.g., 'AR6', 'AR5')",
                "enum": ["AR4", "AR5", "AR6", "GWP20", "GWP100", "Not stated"],
            },
            "min_confidence": {
                "type": "integer",
                "description": "Minimum confidence score (0-100)",
            },
        },
        "required": ["activity_query"],
    },
}


async def _search_database(
    activity_query: str,
    geography: str | None,
    year: int | None,
    scope: str | None,
    gwp_version: str | None,
    min_confidence: int,
    db: AsyncSession,
) -> list[dict]:
    """Execute the database search and return serialisable results."""
    conditions = [
        EmissionFactor.is_current == True,
        EmissionFactor.is_superseded == False,
    ]
    if year:
        conditions.append(
            or_(
                and_(EmissionFactor.validity_start <= date(year, 12, 31),
                     EmissionFactor.validity_end >= date(year, 1, 1)),
                and_(EmissionFactor.validity_start <= date(year, 12, 31),
                     EmissionFactor.validity_end == None),
            )
        )
    if geography and geography.lower() != "global":
        conditions.append(
            or_(
                EmissionFactor.geography_country == geography.upper(),
                EmissionFactor.geography_global == True,
            )
        )
    if scope:
        conditions.append(EmissionFactor.applicable_scopes.contains([scope]))
    if gwp_version:
        conditions.append(EmissionFactor.gwp_version == gwp_version)
    if min_confidence:
        conditions.append(EmissionFactor.confidence_score >= min_confidence)

    # Try semantic search first if embedding is available
    embedding = await generate_embedding(activity_query)
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    # Vector similarity search
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

    # Fall back to trigram if no vector results
    if not records:
        result = await db.execute(
            select(EmissionFactor)
            .where(and_(*conditions))
            .where(EmissionFactor.canonical_activity_name.ilike(f"%{activity_query}%"))
            .order_by(EmissionFactor.confidence_score.desc())
            .limit(10)
        )
        records = result.scalars().all()

    # Serialise for Claude
    return [_serialize_ef(ef) for ef in records]


def _serialize_ef(ef: EmissionFactor) -> dict:
    return {
        "id": str(ef.id),
        "canonical_activity_name": ef.canonical_activity_name,
        "source_activity_name": ef.source_activity_name,
        "activity_category": ef.activity_category,
        "unit": ef.unit,
        "ef_total_co2e": ef.ef_total_co2e,
        "ef_co2": ef.ef_co2,
        "ef_ch4": ef.ef_ch4,
        "ef_n2o": ef.ef_n2o,
        "applicable_scopes": ef.applicable_scopes,
        "lca_stages": ef.lca_stages,
        "source_name": ef.source_name,
        "source_type": ef.source_type.value if ef.source_type else None,
        "validity_start": str(ef.validity_start) if ef.validity_start else None,
        "validity_end": str(ef.validity_end) if ef.validity_end else None,
        "geography_global": ef.geography_global,
        "geography_country": ef.geography_country,
        "geography_region": ef.geography_region,
        "gwp_version": ef.gwp_version.value if ef.gwp_version else None,
        "confidence_score": ef.confidence_score,
        "confidence_breakdown": ef.confidence_breakdown,
        "is_superseded": ef.is_superseded,
        "has_conflict": ef.has_conflict,
        "comments_applicability": ef.comments_applicability,
        "comments_limitations": ef.comments_limitations,
    }


async def run_chat(
    messages: list[dict],
    min_confidence: int,
    db: AsyncSession,
) -> AsyncIterator[str]:
    """
    Run the chat agent with tool-calling and stream the response.
    Yields text chunks as Claude produces them.
    """
    tools = [SEARCH_TOOL]

    # Agentic loop: Claude may call the search tool multiple times
    current_messages = list(messages)
    max_iterations = 5

    for iteration in range(max_iterations):
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=CHAT_SYSTEM_PROMPT,
            tools=tools,
            messages=current_messages,
        )

        # Check for tool use
        tool_uses = [b for b in response.content if b.type == "tool_use"]

        if tool_uses:
            # Execute each tool call
            tool_results = []
            for tool_use in tool_uses:
                if tool_use.name == "search_emission_factors":
                    inp = tool_use.input
                    results = await _search_database(
                        activity_query=inp.get("activity_query", ""),
                        geography=inp.get("geography"),
                        year=inp.get("year"),
                        scope=inp.get("scope"),
                        gwp_version=inp.get("gwp_version"),
                        min_confidence=inp.get("min_confidence", min_confidence),
                        db=db,
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": json.dumps(results, indent=2),
                    })

            # Add Claude's response and tool results to conversation
            current_messages.append({"role": "assistant", "content": response.content})
            current_messages.append({"role": "user", "content": tool_results})

        elif response.stop_reason == "end_turn":
            # Claude is done — yield the final text response
            for block in response.content:
                if hasattr(block, "text"):
                    yield block.text
            return

        else:
            # Unexpected stop — yield whatever text we have
            for block in response.content:
                if hasattr(block, "text"):
                    yield block.text
            return

    yield "I reached the maximum number of search iterations. Please try a more specific query."
