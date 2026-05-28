import uuid
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import (
    String, Text, Boolean, DateTime, Date, Integer, Float,
    ForeignKey, JSON, Enum as SAEnum, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.database import Base
import enum


class SourceType(str, enum.Enum):
    government = "Government / Regulatory body"
    intergovernmental = "Intergovernmental body"
    ghg_protocol = "GHG Protocol / Industry standard"
    commercial_lca = "Commercial LCA database export"
    peer_reviewed = "Peer-reviewed publication"
    industry_association = "Industry association"
    supplier_epd = "Supplier-provided / EPD"
    internal_estimate = "Internal estimate"
    other = "Other"


class GWPVersion(str, enum.Enum):
    ar4 = "AR4"
    ar5 = "AR5"
    ar6 = "AR6"
    gwp20 = "GWP20"
    gwp100 = "GWP100"
    not_stated = "Not stated"


class EmissionFactor(Base):
    """
    The live table — only current, non-superseded versions are shown by default.
    Every edit creates a new EmissionFactorVersion and bumps version_number here.
    """
    __tablename__ = "emission_factors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superseded: Mapped[bool] = mapped_column(Boolean, default=False)
    superseded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("emission_factors.id"), nullable=True)
    superseded_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_conflict: Mapped[bool] = mapped_column(Boolean, default=False)
    migrated: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Activity identity ──────────────────────────────────────────────────
    source_activity_name: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_activity_name: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    activity_category: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── EF values ─────────────────────────────────────────────────────────
    unit: Mapped[str] = mapped_column(String(200), nullable=False)
    ef_total_co2e: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_co2: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_ch4: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_n2o: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_pfc: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_sf6: Mapped[float | None] = mapped_column(Float, nullable=True)
    ef_nf3: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Classification ────────────────────────────────────────────────────
    # Stored as JSON arrays of strings
    applicable_scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # e.g. ["Scope 1", "Scope 3 — Category 4: Upstream transportation & distribution"]
    lca_stages: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # e.g. ["Use phase", "Transport & distribution"]

    # ── Source ────────────────────────────────────────────────────────────
    source_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The Postgres `sourcetype` enum was created with the human-readable
    # VALUES (e.g. "Government / Regulatory body") — see migrations/versions/0001_initial.py.
    # values_callable tells SAEnum to bind and look up by .value instead of
    # the Python member .name (which is the SQLAlchemy default).
    source_type: Mapped[SourceType | None] = mapped_column(
        SAEnum(SourceType, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id"), nullable=True)
    extraction_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("extraction_sessions.id"), nullable=True)

    # ── Validity ─────────────────────────────────────────────────────────
    validity_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    validity_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ── Geography ─────────────────────────────────────────────────────────
    geography_global: Mapped[bool] = mapped_column(Boolean, default=False)
    geography_country: Mapped[str | None] = mapped_column(String(2), nullable=True)  # ISO 3166-1 alpha-2
    geography_region: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO 3166-2

    # ── Confidence ────────────────────────────────────────────────────────
    confidence_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # e.g. {"source_type": 35, "audited": 10, "geography": 20, "recency": 18, "total": 83}

    # ── GWP ───────────────────────────────────────────────────────────────
    gwp_version: Mapped[GWPVersion | None] = mapped_column(
        SAEnum(GWPVersion, values_callable=lambda e: [m.value for m in e]),
        nullable=True, default=GWPVersion.not_stated,
    )

    # ── Supplier (optional, EPD-sourced only) ─────────────────────────────
    supplier_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    supplier_country: Mapped[list | None] = mapped_column(JSON, nullable=True)  # list of ISO 3166-1 alpha-2 codes
    supplier_sector: Mapped[str | None] = mapped_column(Text, nullable=True)
    supplier_epd_reference: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Comments ──────────────────────────────────────────────────────────
    comments_applicability: Mapped[str | None] = mapped_column(Text, nullable=True)
    comments_limitations: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Extension fields ──────────────────────────────────────────────────
    custom_tags: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Semantic search vector ─────────────────────────────────────────────
    # 1536-dim embedding of canonical_activity_name (text-embedding-3-small via OpenAI or
    # claude-generated embedding). Set to None until first embedding generation.
    name_embedding: Mapped[list | None] = mapped_column(Vector(1536), nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_edited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_ef_canonical_name_trgm", "canonical_activity_name", postgresql_using="gin",
              postgresql_ops={"canonical_activity_name": "gin_trgm_ops"}),
        Index("ix_ef_geography", "geography_country", "geography_region"),
        Index("ix_ef_validity", "validity_start", "validity_end"),
        Index("ix_ef_current", "is_current", "is_superseded"),
    )


class EmissionFactorVersion(Base):
    """
    Immutable snapshot of an EmissionFactor at a point in time.
    Created every time an EF record is edited.
    """
    __tablename__ = "emission_factor_versions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    emission_factor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("emission_factors.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)  # full record at that point in time
    edited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    edit_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
