import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from app.models.emission_factor import SourceType, GWPVersion


class EmissionFactorBase(BaseModel):
    source_activity_name: str
    canonical_activity_name: str
    activity_category: Optional[str] = None
    unit: str
    ef_total_co2e: Optional[float] = None
    ef_co2: Optional[float] = None
    ef_ch4: Optional[float] = None
    ef_n2o: Optional[float] = None
    ef_pfc: Optional[float] = None
    ef_sf6: Optional[float] = None
    ef_nf3: Optional[float] = None
    applicable_scopes: Optional[list[str]] = None
    lca_stages: Optional[list[str]] = None
    source_name: Optional[str] = None
    source_type: Optional[SourceType] = None
    source_url: Optional[str] = None
    validity_start: Optional[date] = None
    validity_end: Optional[date] = None
    geography_global: bool = False
    geography_country: Optional[str] = None
    geography_region: Optional[str] = None
    gwp_version: Optional[GWPVersion] = GWPVersion.not_stated
    supplier_name: Optional[str] = None
    supplier_country: Optional[list[str]] = None  # list of ISO 3166-1 alpha-2 codes
    supplier_sector: Optional[str] = None
    supplier_epd_reference: Optional[str] = None
    comments_applicability: Optional[str] = None
    comments_limitations: Optional[str] = None
    custom_tags: Optional[list[str]] = None
    additional_notes: Optional[str] = None


class EmissionFactorCreate(EmissionFactorBase):
    pass


class EmissionFactorUpdate(BaseModel):
    """All fields optional for partial update."""
    source_activity_name: Optional[str] = None
    canonical_activity_name: Optional[str] = None
    activity_category: Optional[str] = None
    unit: Optional[str] = None
    ef_total_co2e: Optional[float] = None
    ef_co2: Optional[float] = None
    ef_ch4: Optional[float] = None
    ef_n2o: Optional[float] = None
    ef_pfc: Optional[float] = None
    ef_sf6: Optional[float] = None
    ef_nf3: Optional[float] = None
    applicable_scopes: Optional[list[str]] = None
    lca_stages: Optional[list[str]] = None
    source_name: Optional[str] = None
    source_type: Optional[SourceType] = None
    source_url: Optional[str] = None
    validity_start: Optional[date] = None
    validity_end: Optional[date] = None
    geography_global: Optional[bool] = None
    geography_country: Optional[str] = None
    geography_region: Optional[str] = None
    gwp_version: Optional[GWPVersion] = None
    supplier_name: Optional[str] = None
    supplier_country: Optional[list[str]] = None  # list of ISO 3166-1 alpha-2 codes
    supplier_sector: Optional[str] = None
    supplier_epd_reference: Optional[str] = None
    comments_applicability: Optional[str] = None
    comments_limitations: Optional[str] = None
    custom_tags: Optional[list[str]] = None
    additional_notes: Optional[str] = None
    edit_summary: Optional[str] = None


class ConfidenceBreakdown(BaseModel):
    source_type: int
    audited: int
    geography: int
    recency: int
    total: int


class EmissionFactorOut(EmissionFactorBase):
    id: uuid.UUID
    version_number: int
    is_current: bool
    is_superseded: bool
    superseded_by_id: Optional[uuid.UUID] = None
    superseded_reason: Optional[str] = None
    has_conflict: bool
    migrated: bool
    confidence_score: Optional[int] = None
    confidence_breakdown: Optional[dict] = None
    source_document_id: Optional[uuid.UUID] = None
    extraction_session_id: Optional[uuid.UUID] = None
    created_by: uuid.UUID
    created_at: datetime
    last_edited_by: Optional[uuid.UUID] = None
    last_edited_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmissionFactorListResponse(BaseModel):
    items: list[EmissionFactorOut]
    total: int
    page: int
    page_size: int


class SupersedeRequest(BaseModel):
    reason: str


class VersionOut(BaseModel):
    id: uuid.UUID
    version_number: int
    snapshot: dict
    edited_by: uuid.UUID
    edited_at: datetime
    edit_summary: Optional[str] = None

    model_config = {"from_attributes": True}


class ConflictingRecord(BaseModel):
    id: uuid.UUID
    canonical_activity_name: str
    ef_total_co2e: Optional[float]
    unit: str
    confidence_score: Optional[int]
    source_name: Optional[str]
    source_type: Optional[str]

    model_config = {"from_attributes": True}
