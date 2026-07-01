"""Request/response schemas for on-demand & watched EnvironDec ingestion."""
import uuid
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


# ── Search ──────────────────────────────────────────────────────────────────

class EnvirondecSearchRequest(BaseModel):
    """Search the EPD Data Hub. `query`/`owner`/`registration_number` are honored
    server-side; `geo`/`classific` are applied client-side to the fetched page."""
    query: Optional[str] = None
    owner: Optional[str] = None
    registration_number: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    page_size: int = 25
    start_index: int = 0


class EnvirondecHit(BaseModel):
    """One search result, annotated for the UI."""
    uuid: Optional[str] = None
    regNo: Optional[str] = None
    registration_number: Optional[str] = None     # regNo with version, no S-P suffix
    name: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    owner: Optional[str] = None
    type: Optional[str] = None
    subType: Optional[str] = None
    refYear: Optional[str] = None
    validUntil: Optional[str] = None
    compliance: Optional[str] = None
    already_in_efdb: bool = False
    # Full flattened hit — echoed back on ingest so no re-search is needed.
    raw: dict[str, Any]


class EnvirondecSearchResponse(BaseModel):
    total: int
    start_index: int
    page_size: int
    hits: list[EnvirondecHit]


# ── Ingest ──────────────────────────────────────────────────────────────────

class EnvirondecIngestRequest(BaseModel):
    """Ingest specific search hits. Pass back the `raw` dicts from search
    (preferred — carries name/owner/geo/regNo needed for mapping). `uuids` is a
    best-effort fallback: the ILCD process is fetched, but hits without the
    search-row metadata may not map. `auto_commit` commits straight away."""
    hits: Optional[list[dict[str, Any]]] = None
    uuids: Optional[list[str]] = None
    auto_commit: bool = False


class EnvirondecIngestItemResult(BaseModel):
    uuid: Optional[str] = None
    registration_number: Optional[str] = None
    product_name: Optional[str] = None
    owner: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    status: str                        # ingestible | no_dataset | no_gwp | error | already_in_efdb
    error: Optional[str] = None


class EnvirondecIngestResponse(BaseModel):
    session_id: Optional[uuid.UUID] = None    # None if nothing was ingestible
    ingested: int
    skipped: int
    committed: bool = False
    commit_summary: Optional[dict[str, Any]] = None
    results: list[EnvirondecIngestItemResult]


# ── Watches ─────────────────────────────────────────────────────────────────

class WatchCreate(BaseModel):
    name: str
    query: Optional[str] = None
    owner: Optional[str] = None
    registration_number: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    mode: str = "queue"                # "queue" | "auto"


class WatchUpdate(BaseModel):
    name: Optional[str] = None
    query: Optional[str] = None
    owner: Optional[str] = None
    registration_number: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    mode: Optional[str] = None
    enabled: Optional[bool] = None


class WatchOut(BaseModel):
    id: uuid.UUID
    name: str
    query: Optional[str] = None
    owner: Optional[str] = None
    registration_number: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    mode: str
    enabled: bool
    seen_count: int = 0
    pending_count: int = 0
    last_checked_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WatchRunResult(BaseModel):
    watch_id: uuid.UUID
    new_found: int
    queued: int
    auto_ingested: int
    session_id: Optional[uuid.UUID] = None


# ── Queue ───────────────────────────────────────────────────────────────────

class QueueItemOut(BaseModel):
    id: uuid.UUID
    watch_id: uuid.UUID
    datahub_uuid: str
    registration_number: Optional[str] = None
    product_name: Optional[str] = None
    owner: Optional[str] = None
    geo: Optional[str] = None
    classific: Optional[str] = None
    status: str
    session_id: Optional[uuid.UUID] = None
    discovered_at: datetime

    model_config = {"from_attributes": True}


class QueueIngestRequest(BaseModel):
    item_ids: list[uuid.UUID]
    auto_commit: bool = False
