"""On-demand EnvironDec (International EPD System) ingestion.

The bulk pipeline (`scripts/crawl_environdec_index.py` → `enrich_environdec.py`
→ `import_environdec_epds.py`) pulls the whole ~17k-dataset library, which is
an expensive exercise and floods the DB with rows irrelevant to any given
client. This module powers the *selective* path instead: search the EPD Data
Hub live, then enrich + map only the datasets you pick into a normal
`ExtractionSession` for review.

No LLM is involved — a single ingest is ~2 HTTP calls (search hit already
carries the metadata; one more GET fetches the machine-readable ILCD process
with GWP per module + declared unit). The deterministic parsing / mapping is
reused verbatim from the scripts so results match the bulk import exactly:

    scripts.scrape_environdec       parse_lcia_results, extract_declared_unit, …
    scripts.crawl_environdec_index  flatten  (list row → index-row shape)
    scripts.enrich_environdec       build_record  (index row + process → enriched)
    scripts.import_environdec_epds  map_record    (enriched → EmissionFactor kwargs)

Only EPDs that expose a machine-readable dataset (a usable A1-A3 GWP + declared
unit) are ingestible here. PDF-only declarations are reported back and skipped —
opt one in manually via the LLM upload flow if you really need it.
"""
from __future__ import annotations

import asyncio
import datetime as _dt
from typing import Any

import httpx

# Reuse the proven deterministic helpers. These modules are import-safe (their
# work happens under __main__), and `scripts` is a package on the app's path.
from scripts.crawl_environdec_index import flatten
from scripts.enrich_environdec import build_record, reg_base
from scripts.import_environdec_epds import map_record

DATAHUB_BASE = "https://data.environdec.com/resource/processes"
USER_AGENT = "GreenMentor-EFDB/1.0 (sustainability research; hello@promad.design)"
_TIMEOUT = httpx.Timeout(60.0, connect=20.0)

# Server-side filters the Data Hub actually honours (verified empirically):
#   name              free-text search across the declaration name
#   owner             substring match on the EPD owner / manufacturer
#   registrationNumber exact registration-number lookup
# `geo` and `classific` are ignored server-side, so they are surfaced as
# columns / optional client-side post-filters rather than query params.
SUPPORTED_PARAMS = ("name", "owner", "registrationNumber")

# When a client-side geo/classific post-filter is active, fetch this many rows
# from the server before filtering so matches aren't missed on page 1.
POSTFILTER_FETCH = 500


def _headers() -> dict[str, str]:
    return {"User-Agent": USER_AGENT, "Accept": "application/json"}


async def _get_json(client: httpx.AsyncClient, url: str, params: dict | None = None) -> Any:
    """GET JSON with a couple of backoff retries on transient failures."""
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            resp = await client.get(url, params=params, headers=_headers(), timeout=_TIMEOUT)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            # Retry only 5xx / network errors; surface 4xx (except 404 above).
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status is not None and status < 500:
                raise
            last_exc = exc
            await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"GET {url} failed after retries: {last_exc}")


def _normalize_hit(row: dict) -> dict:
    """Flatten a Data Hub list row into the index-row shape `build_record`
    consumes. The bulk pipeline round-trips through CSV (everything a string),
    so coerce the numeric year fields to strings for parity."""
    hit = flatten(row)
    for k in ("refYear", "validUntil"):
        if hit.get(k) is not None:
            hit[k] = str(hit[k])
    return hit


def _hit_geo_matches(hit: dict, geo: str | None) -> bool:
    if not geo:
        return True
    return (hit.get("geo") or "").upper() == geo.strip().upper()


def _hit_classific_matches(hit: dict, classific: str | None) -> bool:
    if not classific:
        return True
    return classific.strip().lower() in (hit.get("classific") or "").lower()


async def search(
    *,
    query: str | None = None,
    owner: str | None = None,
    registration_number: str | None = None,
    geo: str | None = None,
    classific: str | None = None,
    page_size: int = 25,
    start_index: int = 0,
) -> dict:
    """Search the EPD Data Hub and return normalized index rows.

    Returns {"total": int, "start_index": int, "page_size": int, "hits": [...]}.
    Each hit is a flattened index-row dict (the shape `build_record` consumes)
    plus `has_dataset` is deferred to ingest time (cheap to check then).

    `geo` / `classific` are applied as a client-side post-filter (the Data Hub
    ignores them server-side), so `total` reflects the server-side
    (name/owner/regNo) result count, not the post-filtered count. When a
    post-filter is active a wider window is fetched (up to `POSTFILTER_FETCH`)
    so the filter is meaningful rather than only seeing the first page.
    """
    post_filtering = bool(geo or classific)
    fetch_size = POSTFILTER_FETCH if post_filtering else page_size
    params: dict[str, Any] = {"search": "true", "format": "json",
                              "pageSize": fetch_size, "startIndex": start_index}
    if query:
        params["name"] = query
    if owner:
        params["owner"] = owner
    if registration_number:
        params["registrationNumber"] = registration_number

    async with httpx.AsyncClient() as client:
        data = await _get_json(client, DATAHUB_BASE, params) or {}

    rows = data.get("data") or []
    hits = [_normalize_hit(r) for r in rows]
    if post_filtering:
        hits = [h for h in hits
                if _hit_geo_matches(h, geo) and _hit_classific_matches(h, classific)]
        hits = hits[:page_size]
    return {
        "total": data.get("totalCount", len(hits)),
        "start_index": start_index,
        "page_size": page_size,
        "hits": hits,
    }


async def _fetch_process(client: httpx.AsyncClient, uuid: str) -> dict | None:
    """Fetch the machine-readable ILCD process (extended view) for one uuid."""
    url = f"{DATAHUB_BASE}/{uuid}"
    return await _get_json(client, url, {"format": "json", "view": "extended"})


def _json_safe(rec: dict) -> dict:
    """Make a `map_record` result storable in the JSON `extraction_result`
    column: dates → ISO strings, drop any non-JSON extras."""
    out = {}
    for k, val in rec.items():
        if isinstance(val, (_dt.date, _dt.datetime)):
            out[k] = val.isoformat()
        else:
            out[k] = val
    return out


async def enrich_and_map(hit: dict) -> dict:
    """Turn one search hit into an ingest outcome.

    Returns a dict with:
      uuid, registration_number, product_name, owner, geo, classific
      status:  "ingestible" | "no_dataset" | "no_gwp"
      record:  JSON-safe EmissionFactor kwargs (only when status == ingestible)
    """
    uuid = hit.get("uuid")
    reg = reg_base(hit.get("regNo", ""))
    base = {
        "uuid": uuid,
        "registration_number": reg,
        "product_name": (hit.get("name") or "").strip(),
        "owner": hit.get("owner"),
        "geo": hit.get("geo"),
        "classific": hit.get("classific"),
    }

    async with httpx.AsyncClient() as client:
        process = await _fetch_process(client, uuid) if uuid else None

    if process is None:
        return {**base, "status": "no_dataset", "record": None}

    enriched = build_record(hit, process)
    mapped = map_record(enriched)
    if mapped is None:
        # dataset exists but no usable A1-A3 GWP + declared unit
        return {**base, "status": "no_gwp", "record": None}

    return {**base, "status": "ingestible", "record": _json_safe(mapped)}


async def enrich_many(hits: list[dict], *, concurrency: int = 5) -> list[dict]:
    """Enrich a batch of hits concurrently (bounded), preserving input order."""
    sem = asyncio.Semaphore(concurrency)

    async def _one(h: dict) -> dict:
        async with sem:
            try:
                return await enrich_and_map(h)
            except Exception as exc:  # noqa: BLE001 - report, don't abort the batch
                return {
                    "uuid": h.get("uuid"),
                    "registration_number": reg_base(h.get("regNo", "")),
                    "product_name": (h.get("name") or "").strip(),
                    "owner": h.get("owner"),
                    "geo": h.get("geo"),
                    "classific": h.get("classific"),
                    "status": "error",
                    "error": str(exc),
                    "record": None,
                }

    return await asyncio.gather(*[_one(h) for h in hits])
