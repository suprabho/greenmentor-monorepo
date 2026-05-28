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
    Document-level metadata auto-detected during scan, expressed in source-
    schema field names. Shown to the user for confirmation before
    extraction starts; confirmed values are passed as hard context to
    every extraction batch.
    """
    source_organization: Optional[str] = None        # e.g. "BEIS / DESNZ"
    source_database: Optional[str] = None
    publication_title: Optional[str] = None
    publication_year: Optional[int] = None
    reference_year: Optional[int] = None             # data year (e.g. 2023)
    valid_from: Optional[str] = None                 # ISO date string YYYY-MM-DD
    valid_to: Optional[str] = None
    country_iso: Optional[str] = None                # ISO 3166-1 alpha-3
    geography_type: Optional[str] = None             # global | national | regional | sub-national | grid-zone
    geography_description: Optional[str] = None     # human-readable, e.g. "United Kingdom"
    gwp_basis: Optional[str] = None                  # AR4 | AR5 | AR6 | GWP20 | GWP100 | Not stated
    ghg_scope: Optional[str] = None                  # "1" | "2" | "3"
    system_boundary: Optional[str] = None
    data_origin: Optional[str] = None                # primary | secondary
    calculation_method: Optional[str] = None
    notes: Optional[str] = None
    guidance_notes: Optional[str] = None
    clarifying_questions: Optional[list[str]] = None


class ScanResult(BaseModel):
    """Result of the initial document scan (before extraction)."""
    session_id: uuid.UUID
    document_id: uuid.UUID
    sections_found: list[DocumentSection]
    estimated_tokens: int
    estimated_cost_usd: float
    page_count: int
    has_scanned_pages: bool
    document_metadata: Optional[DocumentMetadata] = None


class SectionSelection(BaseModel):
    """User selects which sections to extract from, with confirmed document metadata."""
    section_indices: list[int]
    confirmed_metadata: Optional[DocumentMetadata] = None


class ExtractionFieldResult(BaseModel):
    """Per-field extraction result shown in the review panel."""
    value: Optional[str | float | int | bool | list] = None
    source_snippet: Optional[str] = None
    extraction_confidence: str = "high"     # high | medium | low
    extraction_note: Optional[str] = None


class ExtractedRecord(BaseModel):
    """A single extracted emission factor record, in source-schema shape, before approval."""
    index: int
    # Identity
    ef_id: Optional[ExtractionFieldResult] = None
    activity_name: ExtractionFieldResult
    activity_description: Optional[ExtractionFieldResult] = None
    activity_code: Optional[ExtractionFieldResult] = None
    emission_category: ExtractionFieldResult
    sub_category: Optional[ExtractionFieldResult] = None
    ghg_scope: ExtractionFieldResult
    scope3_category: Optional[ExtractionFieldResult] = None
    activity_level: Optional[ExtractionFieldResult] = None
    # EF Value
    ef_value: ExtractionFieldResult
    ghg_species: ExtractionFieldResult
    expressed_as_co2e: ExtractionFieldResult
    gwp_basis: Optional[ExtractionFieldResult] = None
    gwp_value_used: Optional[ExtractionFieldResult] = None
    ef_type: ExtractionFieldResult
    # Units
    numerator_unit: ExtractionFieldResult
    denominator_unit: ExtractionFieldResult
    denominator_basis: Optional[ExtractionFieldResult] = None
    unit_notes: Optional[ExtractionFieldResult] = None
    # Geography
    geography_type: ExtractionFieldResult
    country_iso: Optional[ExtractionFieldResult] = None
    region_name: Optional[ExtractionFieldResult] = None
    grid_zone_id: Optional[ExtractionFieldResult] = None
    location_basis: Optional[ExtractionFieldResult] = None
    # Technology
    fuel_material_type: Optional[ExtractionFieldResult] = None
    technology_descriptor: Optional[ExtractionFieldResult] = None
    vehicle_type: Optional[ExtractionFieldResult] = None
    end_use_sector: Optional[ExtractionFieldResult] = None
    combustion_type: Optional[ExtractionFieldResult] = None
    carbon_content_fraction: Optional[ExtractionFieldResult] = None
    # Temporal
    reference_year: ExtractionFieldResult
    valid_from: Optional[ExtractionFieldResult] = None
    valid_to: Optional[ExtractionFieldResult] = None
    ef_version: Optional[ExtractionFieldResult] = None
    update_frequency: Optional[ExtractionFieldResult] = None
    # Source
    source_organization: ExtractionFieldResult
    source_database: Optional[ExtractionFieldResult] = None
    publication_title: Optional[ExtractionFieldResult] = None
    publication_year: Optional[ExtractionFieldResult] = None
    source_url: Optional[ExtractionFieldResult] = None
    original_ef_value: Optional[ExtractionFieldResult] = None
    original_unit: Optional[ExtractionFieldResult] = None
    data_origin: ExtractionFieldResult
    # Methodology
    calculation_method: ExtractionFieldResult
    system_boundary: ExtractionFieldResult
    includes_biogenic_co2: Optional[ExtractionFieldResult] = None
    includes_land_use_change: Optional[ExtractionFieldResult] = None
    allocation_method: Optional[ExtractionFieldResult] = None
    upstream_included: Optional[ExtractionFieldResult] = None
    # DQ
    uncertainty_pct: Optional[ExtractionFieldResult] = None
    uncertainty_method: Optional[ExtractionFieldResult] = None
    dq_score_overall: Optional[ExtractionFieldResult] = None
    dq_geographic_rep: Optional[ExtractionFieldResult] = None
    dq_temporal_rep: Optional[ExtractionFieldResult] = None
    dq_tech_rep: Optional[ExtractionFieldResult] = None
    third_party_verified: Optional[ExtractionFieldResult] = None
    # Operational
    status: Optional[ExtractionFieldResult] = None
    framework_tags: Optional[ExtractionFieldResult] = None
    sector_tags: Optional[ExtractionFieldResult] = None
    is_default_ef: Optional[ExtractionFieldResult] = None
    notes: Optional[ExtractionFieldResult] = None
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
    action: str
    rejection_reason: Optional[str] = None
    edited_data: Optional[dict] = None


class BulkReviewAction(BaseModel):
    action: str
    indices: Optional[list[int]] = None
    rejection_reason: Optional[str] = None


class ReviewSummary(BaseModel):
    approved: int
    rejected: int
    conflicts_flagged: int
    records_committed: list[uuid.UUID]
