"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All EFDB tables must land in the `efdb` schema (we share a Supabase
    # Postgres instance with other apps that own `public`). The DDL below
    # uses unqualified table names, so we lean on `search_path` for routing.
    # `public` stays second in the path so the `vector` type and the
    # `gin_trgm_ops` operator class (both installed there) remain reachable.
    op.execute("SET search_path TO efdb, public")

    # Enable required PostgreSQL extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("admin", "analyst", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # source_documents
    op.create_table(
        "source_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("original_filename", sa.String(500), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("uploaded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estimated_tokens", sa.Integer(), nullable=True),
        sa.Column("actual_tokens_used", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
    )

    # extraction_sessions
    op.create_table(
        "extraction_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_document_id", sa.Uuid(), sa.ForeignKey("source_documents.id"), nullable=False),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.Enum(
            "pending", "extracting", "awaiting_review", "in_review", "completed", "failed",
            name="sessionstatus"
        ), nullable=False),
        sa.Column("selected_sections", sa.JSON(), nullable=True),
        sa.Column("extraction_result", sa.JSON(), nullable=True),
        sa.Column("review_progress", sa.JSON(), nullable=True),
        sa.Column("total_extracted", sa.Integer(), default=0),
        sa.Column("total_approved", sa.Integer(), default=0),
        sa.Column("total_rejected", sa.Integer(), default=0),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # rejected_extractions
    op.create_table(
        "rejected_extractions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("extraction_sessions.id"), nullable=False),
        sa.Column("rejected_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("extracted_data", sa.JSON(), nullable=False),
    )

    # emission_factors
    op.create_table(
        "emission_factors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("version_number", sa.Integer(), default=1),
        sa.Column("is_current", sa.Boolean(), default=True),
        sa.Column("is_superseded", sa.Boolean(), default=False),
        sa.Column("superseded_by_id", sa.Uuid(), sa.ForeignKey("emission_factors.id"), nullable=True),
        sa.Column("superseded_reason", sa.Text(), nullable=True),
        sa.Column("has_conflict", sa.Boolean(), default=False),
        sa.Column("migrated", sa.Boolean(), default=False),
        # Activity
        sa.Column("source_activity_name", sa.Text(), nullable=False),
        sa.Column("canonical_activity_name", sa.Text(), nullable=False),
        sa.Column("activity_category", sa.Text(), nullable=True),
        # EF values
        sa.Column("unit", sa.String(200), nullable=False),
        sa.Column("ef_total_co2e", sa.Float(), nullable=True),
        sa.Column("ef_co2", sa.Float(), nullable=True),
        sa.Column("ef_ch4", sa.Float(), nullable=True),
        sa.Column("ef_n2o", sa.Float(), nullable=True),
        sa.Column("ef_pfc", sa.Float(), nullable=True),
        sa.Column("ef_sf6", sa.Float(), nullable=True),
        sa.Column("ef_nf3", sa.Float(), nullable=True),
        # Classification
        sa.Column("applicable_scopes", sa.JSON(), nullable=True),
        sa.Column("lca_stages", sa.JSON(), nullable=True),
        # Source
        sa.Column("source_name", sa.Text(), nullable=True),
        sa.Column("source_type", sa.Enum(
            "Government / Regulatory body", "Intergovernmental body",
            "GHG Protocol / Industry standard", "Commercial LCA database export",
            "Peer-reviewed publication", "Industry association",
            "Supplier-provided / EPD", "Internal estimate", "Other",
            name="sourcetype"
        ), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("source_document_id", sa.Uuid(), sa.ForeignKey("source_documents.id"), nullable=True),
        sa.Column("extraction_session_id", sa.Uuid(), sa.ForeignKey("extraction_sessions.id"), nullable=True),
        # Validity
        sa.Column("validity_start", sa.Date(), nullable=True),
        sa.Column("validity_end", sa.Date(), nullable=True),
        # Geography
        sa.Column("geography_global", sa.Boolean(), default=False),
        sa.Column("geography_country", sa.String(2), nullable=True),
        sa.Column("geography_region", sa.String(10), nullable=True),
        # Confidence
        sa.Column("confidence_score", sa.Integer(), nullable=True),
        sa.Column("confidence_breakdown", sa.JSON(), nullable=True),
        # GWP
        sa.Column("gwp_version", sa.Enum("AR4", "AR5", "AR6", "GWP20", "GWP100", "Not stated", name="gwpversion"), nullable=True),
        # Supplier
        sa.Column("supplier_name", sa.Text(), nullable=True),
        sa.Column("supplier_country", sa.String(2), nullable=True),
        sa.Column("supplier_sector", sa.Text(), nullable=True),
        sa.Column("supplier_epd_reference", sa.Text(), nullable=True),
        # Comments
        sa.Column("comments_applicability", sa.Text(), nullable=True),
        sa.Column("comments_limitations", sa.Text(), nullable=True),
        # Extensions
        sa.Column("custom_tags", sa.JSON(), nullable=True),
        sa.Column("additional_notes", sa.Text(), nullable=True),
        # Vector embedding (1536-dim for text-embedding-3-small)
        sa.Column("name_embedding", Vector(1536), nullable=True),
        # Audit
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_edited_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("last_edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_ef_canonical_name", "emission_factors", ["canonical_activity_name"])
    op.create_index("ix_ef_geography", "emission_factors", ["geography_country", "geography_region"])
    op.create_index("ix_ef_validity", "emission_factors", ["validity_start", "validity_end"])
    op.create_index("ix_ef_current", "emission_factors", ["is_current", "is_superseded"])
    # GIN index for trigram search on canonical name
    op.execute(
        "CREATE INDEX ix_ef_canonical_trgm ON emission_factors "
        "USING gin(canonical_activity_name gin_trgm_ops)"
    )
    # HNSW index for fast vector similarity search
    op.execute(
        "CREATE INDEX ix_ef_embedding ON emission_factors "
        "USING hnsw(name_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    # emission_factor_versions
    op.create_table(
        "emission_factor_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("emission_factor_id", sa.Uuid(), sa.ForeignKey("emission_factors.id"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("edited_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edit_summary", sa.Text(), nullable=True),
    )
    op.create_index("ix_efv_ef_id", "emission_factor_versions", ["emission_factor_id"])

    # audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("action", sa.Enum(
            "record_created", "record_edited", "record_deleted", "record_approved",
            "record_rejected", "record_superseded", "conflict_flagged", "conflict_resolved",
            "confidence_recalculated", "review_session_resumed", "version_restored",
            name="auditaction"
        ), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("emission_factor_id", sa.Uuid(), sa.ForeignKey("emission_factors.id"), nullable=True),
        sa.Column("extraction_session_id", sa.Uuid(), sa.ForeignKey("extraction_sessions.id"), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_action", "audit_log", ["action"])
    op.create_index("ix_audit_ef_id", "audit_log", ["emission_factor_id"])
    op.create_index("ix_audit_created", "audit_log", ["created_at"])

    # confidence_weight_configs
    op.create_table(
        "confidence_weight_configs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("is_active", sa.Boolean(), default=False),
        sa.Column("weights", sa.JSON(), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_cwc_active", "confidence_weight_configs", ["is_active"])


def downgrade() -> None:
    # Same `search_path` shim as upgrade() — keeps DROPs aimed at `efdb`.
    op.execute("SET search_path TO efdb, public")

    op.drop_table("confidence_weight_configs")
    op.drop_table("audit_log")
    op.drop_table("emission_factor_versions")
    op.drop_table("emission_factors")
    op.drop_table("rejected_extractions")
    op.drop_table("extraction_sessions")
    op.drop_table("source_documents")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS auditaction")
    op.execute("DROP TYPE IF EXISTS gwpversion")
    op.execute("DROP TYPE IF EXISTS sourcetype")
    op.execute("DROP TYPE IF EXISTS sessionstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
