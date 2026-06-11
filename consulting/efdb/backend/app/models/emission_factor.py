import uuid
from datetime import datetime, date, timezone
from sqlalchemy import (
    String, Text, Boolean, DateTime, Date, Integer, Float,
    ForeignKey, JSON, Index,
)
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.database import Base


class EmissionFactor(Base):
    """
    Flat 65-column source schema (Identity / EF Value / Units / Geography /
    Technology / Temporal / Source / Methodology / DQ / Operational).
    One row per (activity, ghg_species). ENUM-ish fields are free-form
    Text; validation lives in Pydantic.
    """
    __tablename__ = "emission_factors"

    # ── System / EFDB-internal ────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    has_conflict: Mapped[bool] = mapped_column(Boolean, default=False)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id"), nullable=True)
    extraction_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("extraction_sessions.id"), nullable=True)
    name_embedding: Mapped[list | None] = mapped_column(Vector(1536), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_edited_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Identity (9) ──────────────────────────────────────────────────────
    ef_id: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    activity_name: Mapped[str] = mapped_column(Text, nullable=False)
    activity_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    activity_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    emission_category: Mapped[str] = mapped_column(Text, nullable=False)
    sub_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    ghg_scope: Mapped[str] = mapped_column(Text, nullable=False)
    scope3_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    activity_level: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── EF Value (6) ──────────────────────────────────────────────────────
    ef_value: Mapped[float] = mapped_column(Float, nullable=False)
    ghg_species: Mapped[str] = mapped_column(Text, nullable=False)
    expressed_as_co2e: Mapped[bool] = mapped_column(Boolean, nullable=False)
    gwp_basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    gwp_value_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_type: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Units (4) ─────────────────────────────────────────────────────────
    numerator_unit: Mapped[str] = mapped_column(Text, nullable=False)
    denominator_unit: Mapped[str] = mapped_column(Text, nullable=False)
    denominator_basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Geography (5) ─────────────────────────────────────────────────────
    geography_type: Mapped[str] = mapped_column(Text, nullable=False)
    country_iso: Mapped[str | None] = mapped_column(String(3), nullable=True)
    region_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    grid_zone_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_basis: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Technology (6) ────────────────────────────────────────────────────
    fuel_material_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    technology_descriptor: Mapped[str | None] = mapped_column(Text, nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_use_sector: Mapped[str | None] = mapped_column(Text, nullable=True)
    combustion_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    carbon_content_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Temporal (5) ──────────────────────────────────────────────────────
    reference_year: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    ef_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    update_frequency: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Source (8) ────────────────────────────────────────────────────────
    source_organization: Mapped[str] = mapped_column(Text, nullable=False)
    source_database: Mapped[str | None] = mapped_column(Text, nullable=True)
    publication_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    publication_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_ef_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_origin: Mapped[str] = mapped_column(Text, nullable=False)
    # Supplier / EPD provenance (populated for EPD-sourced records)
    source_type: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. "Supplier-provided / EPD"
    supplier_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    supplier_country: Mapped[str | None] = mapped_column(String(3), nullable=True)  # ISO3
    supplier_sector: Mapped[str | None] = mapped_column(Text, nullable=True)
    supplier_epd_reference: Mapped[str | None] = mapped_column(Text, nullable=True)  # EPD registration number

    # ── Methodology (6) ───────────────────────────────────────────────────
    calculation_method: Mapped[str] = mapped_column(Text, nullable=False)
    system_boundary: Mapped[str] = mapped_column(Text, nullable=False)
    includes_biogenic_co2: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    includes_land_use_change: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    allocation_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    upstream_included: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # ── DQ (7) ────────────────────────────────────────────────────────────
    uncertainty_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    uncertainty_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    dq_score_overall: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dq_geographic_rep: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dq_temporal_rep: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dq_tech_rep: Mapped[int | None] = mapped_column(Integer, nullable=True)
    third_party_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # ── Operational (10) ──────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    superseded_by_ef_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    superseded_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    framework_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    sector_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_default_ef: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    created_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_ef_activity_name_trgm", "activity_name", postgresql_using="gin",
              postgresql_ops={"activity_name": "gin_trgm_ops"}),
        Index("ix_ef_category", "emission_category"),
        Index("ix_ef_scope", "ghg_scope"),
        Index("ix_ef_country", "country_iso"),
        Index("ix_ef_org", "source_organization"),
        Index("ix_ef_year", "reference_year"),
        Index("ix_ef_status", "status"),
        Index("ix_ef_species", "ghg_species"),
    )


class EmissionFactorVersion(Base):
    """Immutable snapshot of an EmissionFactor at a point in time."""
    __tablename__ = "emission_factor_versions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("emission_factors.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    edited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    edit_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
