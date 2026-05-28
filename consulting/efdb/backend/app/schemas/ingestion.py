import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.extraction_session import SessionStatus


class DocumentSection(BaseModel):
    """A table or section identified in the source document."""
    index: int
    title: str
    page_range: str       # e.g. "14-17"
    column_headers: list[str]
    description: str
    row_count_estimate: int


class DocumentMetadata(BaseModel):
    """
    Document-level metadata auto-detected during scan.
    Shown to the user for confirmation before extraction starts.
    Confirmed values are passed as hard context to every extraction batch.
    """
    source_name: Optional[str] = None           # e.g. "UK Government GHG Conversion Factors 2023"
    source_type: Optional[str] = None           # one of the SourceType enum values
    year: Optional[int] = None                  # publication year (kept for backward compat)
    validity_start: Optional[int] = None        # year the factors become effective
    validity_end: Optional[int] = None          # year the factors expire (None = open-ended)
    geography_country: Optional[str] = None     # ISO 3166-1 alpha-2
    geography_description: Optional[str] = None # human-readable e.g. "United Kingdom"
    gwp_version: Optional[str] = None           # AR4 | AR5 | AR6 | Not stated
    applicable_scopes: Optional[list[str]] = None
    lca_stages: Optional[list[str]] = None
    comments_applicability: Optional[str] = None  # usage guidance from cover page / notes
    guidance_notes: Optional[str] = None           # additional context / caveats
    clarifying_questions: Optional[list[str]] = None  # questions Claude wants to ask the user


class ScanResult(BaseModel):
    """Result of the initial document scan (before extraction)."""
    session_id: uuid.UUID
    document_id: uuid.UUID
    sections_found: list[DocumentSection]
    estimated_tokens: int
    estimated_cost_usd: float
    page_count: int
    has_scanned_pages: bool
    document_metadata: Optional[DocumentMetadata] = None  # auto-detected context


class SectionSelection(BaseModel):
    """User selects which sections to extract from, with confirmed document metadata."""
    section_indices: list[int]
    confirmed_metadata: Optional[DocumentMetadata] = None  # user-confirmed context for extraction


class ExtractionFieldResult(BaseModel):
    """Per-field extraction result shown in the review panel."""
    value: Optional[str | float | int | list] = None
    source_snippet: Optional[str] = None    # exact text from source that produced this value
    extraction_confidence: str = "high"     # high | medium | low
    extraction_note: Optional[str] = None   # reason if null or flagged


class ExtractedRecord(BaseModel):
    """A single extracted emission factor record, before user approval."""
    index: int                              # position in the extraction batch
    source_activity_name: ExtractionFieldResult
    canonical_activity_name: ExtractionFieldResult
    activity_category: ExtractionFieldResult
    unit: ExtractionFieldResult
    ef_total_co2e: ExtractionFieldResult
    ef_co2: ExtractionFieldResult
    ef_ch4: ExtractionFieldResult
    ef_n2o: ExtractionFieldResult
    ef_pfc: ExtractionFieldResult
    ef_sf6: ExtractionFieldResult
    ef_nf3: ExtractionFieldResult
    applicable_scopes: ExtractionFieldResult
    lca_stages: ExtractionFieldResult
    source_name: ExtractionFieldResult
    source_type: ExtractionFieldResult
    source_url: ExtractionFieldResult
    validity_start: ExtractionFieldResult
    validity_end: ExtractionFieldResult
    geography_global: ExtractionFieldResult
    geography_country: ExtractionFieldResult
    geography_region: ExtractionFieldResult
    gwp_version: ExtractionFieldResult
    supplier_name: ExtractionFieldResult
    supplier_country: ExtractionFieldResult
    supplier_sector: ExtractionFieldResult
    supplier_epd_reference: ExtractionFieldResult
    comments_applicability: ExtractionFieldResult
    comments_limitations: ExtractionFieldResult
    custom_tags: ExtractionFieldResult
    additional_notes: ExtractionFieldResult
    # Flags
    has_outlier_values: bool = False
    has_unit_mismatch: bool = False
    outlier_notes: list[str] = []


class SessionStatusOut(BaseModel):
    id: uuid.UUID
    status: SessionStatus
    total_extracted: int
    total_approved: int
    total_rejected: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewAction(BaseModel):
    """Approve or reject a single record (with optional field edits)."""
    action: str                             # "approve" | "reject"
    rejection_reason: Optional[str] = None
    # If approving with edits, send the full corrected record data
    edited_data: Optional[dict] = None


class BulkReviewAction(BaseModel):
    """Approve or reject a range of records by index."""
    action: str                             # "approve_all" | "reject_all"
    indices: Optional[list[int]] = None     # None means "all pending"
    rejection_reason: Optional[str] = None


class ReviewSummary(BaseModel):
    approved: int
    rejected: int
    conflicts_flagged: int
    records_committed: list[uuid.UUID]
