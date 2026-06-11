import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class EmissionFactorBase(BaseModel):
    """Source-schema fields. Required NOT NULL columns are non-Optional."""
    # Identity
    ef_id: Optional[str] = None
    activity_name: str
    activity_description: Optional[str] = None
    activity_code: Optional[str] = None
    emission_category: str
    sub_category: Optional[str] = None
    ghg_scope: str
    scope3_category: Optional[str] = None
    activity_level: Optional[str] = None
    # EF Value
    ef_value: float
    ghg_species: str
    expressed_as_co2e: bool
    gwp_basis: Optional[str] = None
    gwp_value_used: Optional[float] = None
    ef_type: str
    # Units
    numerator_unit: str
    denominator_unit: str
    denominator_basis: Optional[str] = None
    unit_notes: Optional[str] = None
    # Geography
    geography_type: str
    country_iso: Optional[str] = None
    region_name: Optional[str] = None
    grid_zone_id: Optional[str] = None
    location_basis: Optional[str] = None
    # Technology
    fuel_material_type: Optional[str] = None
    technology_descriptor: Optional[str] = None
    vehicle_type: Optional[str] = None
    end_use_sector: Optional[str] = None
    combustion_type: Optional[str] = None
    carbon_content_fraction: Optional[float] = None
    # Temporal
    reference_year: int
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    ef_version: Optional[str] = None
    update_frequency: Optional[str] = None
    # Source
    source_organization: str
    source_database: Optional[str] = None
    publication_title: Optional[str] = None
    publication_year: Optional[int] = None
    source_url: Optional[str] = None
    original_ef_value: Optional[float] = None
    original_unit: Optional[str] = None
    data_origin: str
    # Supplier / EPD provenance
    source_type: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_country: Optional[str] = None
    supplier_sector: Optional[str] = None
    supplier_epd_reference: Optional[str] = None
    # Methodology
    calculation_method: str
    system_boundary: str
    includes_biogenic_co2: Optional[bool] = None
    includes_land_use_change: Optional[bool] = None
    allocation_method: Optional[str] = None
    upstream_included: Optional[bool] = None
    # DQ
    uncertainty_pct: Optional[float] = None
    uncertainty_method: Optional[str] = None
    dq_score_overall: Optional[int] = None
    dq_geographic_rep: Optional[int] = None
    dq_temporal_rep: Optional[int] = None
    dq_tech_rep: Optional[int] = None
    third_party_verified: Optional[bool] = None
    # Operational
    status: str = "active"
    superseded_by_ef_id: Optional[str] = None
    superseded_reason: Optional[str] = None
    framework_tags: Optional[list[str]] = None
    sector_tags: Optional[list[str]] = None
    is_default_ef: Optional[bool] = None
    created_by: Optional[str] = None
    notes: Optional[str] = None


class EmissionFactorCreate(EmissionFactorBase):
    pass


class EmissionFactorUpdate(BaseModel):
    """All fields optional for partial update."""
    activity_name: Optional[str] = None
    activity_description: Optional[str] = None
    activity_code: Optional[str] = None
    emission_category: Optional[str] = None
    sub_category: Optional[str] = None
    ghg_scope: Optional[str] = None
    scope3_category: Optional[str] = None
    activity_level: Optional[str] = None
    ef_value: Optional[float] = None
    ghg_species: Optional[str] = None
    expressed_as_co2e: Optional[bool] = None
    gwp_basis: Optional[str] = None
    gwp_value_used: Optional[float] = None
    ef_type: Optional[str] = None
    numerator_unit: Optional[str] = None
    denominator_unit: Optional[str] = None
    denominator_basis: Optional[str] = None
    unit_notes: Optional[str] = None
    geography_type: Optional[str] = None
    country_iso: Optional[str] = None
    region_name: Optional[str] = None
    grid_zone_id: Optional[str] = None
    location_basis: Optional[str] = None
    fuel_material_type: Optional[str] = None
    technology_descriptor: Optional[str] = None
    vehicle_type: Optional[str] = None
    end_use_sector: Optional[str] = None
    combustion_type: Optional[str] = None
    carbon_content_fraction: Optional[float] = None
    reference_year: Optional[int] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    ef_version: Optional[str] = None
    update_frequency: Optional[str] = None
    source_organization: Optional[str] = None
    source_database: Optional[str] = None
    publication_title: Optional[str] = None
    publication_year: Optional[int] = None
    source_url: Optional[str] = None
    original_ef_value: Optional[float] = None
    original_unit: Optional[str] = None
    data_origin: Optional[str] = None
    source_type: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_country: Optional[str] = None
    supplier_sector: Optional[str] = None
    supplier_epd_reference: Optional[str] = None
    calculation_method: Optional[str] = None
    system_boundary: Optional[str] = None
    includes_biogenic_co2: Optional[bool] = None
    includes_land_use_change: Optional[bool] = None
    allocation_method: Optional[str] = None
    upstream_included: Optional[bool] = None
    uncertainty_pct: Optional[float] = None
    uncertainty_method: Optional[str] = None
    dq_score_overall: Optional[int] = None
    dq_geographic_rep: Optional[int] = None
    dq_temporal_rep: Optional[int] = None
    dq_tech_rep: Optional[int] = None
    third_party_verified: Optional[bool] = None
    status: Optional[str] = None
    superseded_by_ef_id: Optional[str] = None
    superseded_reason: Optional[str] = None
    framework_tags: Optional[list[str]] = None
    sector_tags: Optional[list[str]] = None
    is_default_ef: Optional[bool] = None
    notes: Optional[str] = None
    edit_summary: Optional[str] = None


class EmissionFactorOut(EmissionFactorBase):
    id: uuid.UUID
    version_number: int
    has_conflict: bool
    source_document_id: Optional[uuid.UUID] = None
    extraction_session_id: Optional[uuid.UUID] = None
    created_by_user_id: Optional[uuid.UUID] = None
    last_edited_by_user_id: Optional[uuid.UUID] = None
    last_edited_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmissionFactorListResponse(BaseModel):
    items: list[EmissionFactorOut]
    total: int
    page: int
    page_size: int


class SupersedeRequest(BaseModel):
    reason: str
    superseded_by_ef_id: Optional[str] = None


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
    activity_name: str
    ef_value: float
    ghg_species: str
    numerator_unit: str
    denominator_unit: str
    source_organization: str
    country_iso: Optional[str] = None
    reference_year: int

    model_config = {"from_attributes": True}
