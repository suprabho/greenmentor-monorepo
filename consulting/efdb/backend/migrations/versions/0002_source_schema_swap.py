"""Swap emission_factors to flat source schema (Identity/EF Value/Units/Geography/Technology/Temporal/Source/Methodology/DQ/Operational).

Adds ~50 source-schema columns, backfills the 7 pre-existing target-schema
rows into the new columns, then drops the target-only columns and enums.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET search_path TO efdb, public")

    # ── 1. ADD the source-schema columns (nullable initially) ──────────────
    add_cols = [
        # Identity
        sa.Column("ef_id", sa.Text(), nullable=True),
        sa.Column("activity_name", sa.Text(), nullable=True),
        sa.Column("activity_description", sa.Text(), nullable=True),
        sa.Column("activity_code", sa.Text(), nullable=True),
        sa.Column("emission_category", sa.Text(), nullable=True),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("ghg_scope", sa.Text(), nullable=True),
        sa.Column("scope3_category", sa.Text(), nullable=True),
        sa.Column("activity_level", sa.Text(), nullable=True),
        # EF Value
        sa.Column("ef_value", sa.Float(), nullable=True),
        sa.Column("ghg_species", sa.Text(), nullable=True),
        sa.Column("expressed_as_co2e", sa.Boolean(), nullable=True),
        sa.Column("gwp_basis", sa.Text(), nullable=True),
        sa.Column("gwp_value_used", sa.Float(), nullable=True),
        sa.Column("ef_type", sa.Text(), nullable=True),
        # Units
        sa.Column("numerator_unit", sa.Text(), nullable=True),
        sa.Column("denominator_unit", sa.Text(), nullable=True),
        sa.Column("denominator_basis", sa.Text(), nullable=True),
        sa.Column("unit_notes", sa.Text(), nullable=True),
        # Geography
        sa.Column("geography_type", sa.Text(), nullable=True),
        sa.Column("country_iso", sa.String(length=3), nullable=True),
        sa.Column("region_name", sa.Text(), nullable=True),
        sa.Column("grid_zone_id", sa.Text(), nullable=True),
        sa.Column("location_basis", sa.Text(), nullable=True),
        # Technology
        sa.Column("fuel_material_type", sa.Text(), nullable=True),
        sa.Column("technology_descriptor", sa.Text(), nullable=True),
        sa.Column("vehicle_type", sa.Text(), nullable=True),
        sa.Column("end_use_sector", sa.Text(), nullable=True),
        sa.Column("combustion_type", sa.Text(), nullable=True),
        sa.Column("carbon_content_fraction", sa.Float(), nullable=True),
        # Temporal
        sa.Column("reference_year", sa.Integer(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("ef_version", sa.Text(), nullable=True),
        sa.Column("update_frequency", sa.Text(), nullable=True),
        # Source
        sa.Column("source_organization", sa.Text(), nullable=True),
        sa.Column("source_database", sa.Text(), nullable=True),
        sa.Column("publication_title", sa.Text(), nullable=True),
        sa.Column("publication_year", sa.Integer(), nullable=True),
        sa.Column("original_ef_value", sa.Float(), nullable=True),
        sa.Column("original_unit", sa.Text(), nullable=True),
        sa.Column("data_origin", sa.Text(), nullable=True),
        # Methodology
        sa.Column("calculation_method", sa.Text(), nullable=True),
        sa.Column("system_boundary", sa.Text(), nullable=True),
        sa.Column("includes_biogenic_co2", sa.Boolean(), nullable=True),
        sa.Column("includes_land_use_change", sa.Boolean(), nullable=True),
        sa.Column("allocation_method", sa.Text(), nullable=True),
        sa.Column("upstream_included", sa.Boolean(), nullable=True),
        # DQ
        sa.Column("uncertainty_pct", sa.Float(), nullable=True),
        sa.Column("uncertainty_method", sa.Text(), nullable=True),
        sa.Column("dq_score_overall", sa.Integer(), nullable=True),
        sa.Column("dq_geographic_rep", sa.Integer(), nullable=True),
        sa.Column("dq_temporal_rep", sa.Integer(), nullable=True),
        sa.Column("dq_tech_rep", sa.Integer(), nullable=True),
        sa.Column("third_party_verified", sa.Boolean(), nullable=True),
        # Operational
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("superseded_by_ef_id", sa.Text(), nullable=True),
        sa.Column("framework_tags", sa.JSON(), nullable=True),
        sa.Column("sector_tags", sa.JSON(), nullable=True),
        sa.Column("is_default_ef", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # System (new FK columns; existing created_by UUID gets renamed to
        # created_by_user_id below, and the source-style `created_by` (text label)
        # is added here)
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("last_edited_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by_label", sa.Text(), nullable=True),
    ]
    for col in add_cols:
        op.add_column("emission_factors", col)

    # Unique constraint on ef_id (deferred — let backfill set it first; we
    # add the unique index at the end of upgrade).

    # ── 2. BACKFILL existing rows from target columns into source columns ──
    # All 7 pre-existing rows happen to be India / CO2e / single-species,
    # but the migration uses generic SQL so it works if more rows exist.

    # 2a. Identity, units, scope, geography, GWP, validity.
    op.execute("""
        UPDATE emission_factors SET
            activity_name = COALESCE(canonical_activity_name, source_activity_name, 'unknown'),
            activity_description = NULL,
            emission_category = CASE
                WHEN lower(coalesce(activity_category, '')) LIKE '%electric%'   THEN 'energy'
                WHEN lower(coalesce(activity_category, '')) LIKE '%energy%'     THEN 'energy'
                WHEN lower(coalesce(activity_category, '')) LIKE '%fuel%'       THEN 'energy'
                WHEN lower(coalesce(activity_category, '')) LIKE '%transport%'  THEN 'transport'
                WHEN lower(coalesce(activity_category, '')) LIKE '%material%'   THEN 'material'
                WHEN lower(coalesce(activity_category, '')) LIKE '%waste%'      THEN 'waste'
                ELSE 'energy'
            END,
            sub_category = activity_category,
            ghg_scope = CASE
                WHEN applicable_scopes::text LIKE '%Scope 1%' THEN '1'
                WHEN applicable_scopes::text LIKE '%Scope 2%' THEN '2'
                WHEN applicable_scopes::text LIKE '%Scope 3%' THEN '3'
                ELSE '3'
            END,
            ef_value = ef_total_co2e,
            ghg_species = CASE WHEN ef_total_co2e IS NOT NULL THEN 'CO2e' ELSE 'CO2' END,
            expressed_as_co2e = (ef_total_co2e IS NOT NULL),
            gwp_basis = CASE WHEN gwp_version IS NOT NULL THEN gwp_version::text ELSE NULL END,
            ef_type = 'activity-based',
            numerator_unit = split_part(coalesce(unit, ''), '/', 1),
            denominator_unit = trim(split_part(coalesce(unit, ''), '/', 2)),
            geography_type = CASE
                WHEN geography_global THEN 'global'
                WHEN geography_country IS NOT NULL THEN 'national'
                ELSE 'global'
            END,
            country_iso = CASE geography_country
                WHEN 'IN' THEN 'IND' WHEN 'US' THEN 'USA' WHEN 'GB' THEN 'GBR'
                WHEN 'DE' THEN 'DEU' WHEN 'FR' THEN 'FRA' WHEN 'NL' THEN 'NLD'
                WHEN 'SG' THEN 'SGP' WHEN 'AU' THEN 'AUS' WHEN 'CN' THEN 'CHN'
                WHEN 'JP' THEN 'JPN' WHEN 'IT' THEN 'ITA' WHEN 'CA' THEN 'CAN'
                WHEN 'AT' THEN 'AUT' WHEN 'CH' THEN 'CHE' WHEN 'NO' THEN 'NOR'
                ELSE NULLIF(upper(geography_country), '')
            END,
            region_name = geography_region,
            reference_year = COALESCE(extract(year from validity_start)::int, extract(year from created_at)::int, 2024),
            valid_from = validity_start,
            valid_to = validity_end,
            source_organization = COALESCE(source_name, 'Unknown'),
            data_origin = 'secondary',
            calculation_method = 'activity-based',
            system_boundary = 'gate-to-gate',
            status = CASE
                WHEN is_superseded THEN 'superseded'
                WHEN NOT is_current THEN 'deprecated'
                ELSE 'active'
            END,
            updated_at = COALESCE(last_edited_at, created_at),
            created_by_user_id = created_by,
            last_edited_by_user_id = last_edited_by,
            created_by_label = 'pre-source-schema-backfill',
            -- Trim
            notes = CASE
                WHEN coalesce(comments_applicability,'') = '' AND coalesce(comments_limitations,'') = ''
                THEN additional_notes
                WHEN additional_notes IS NULL
                THEN trim(both ' | ' from concat_ws(' | ',
                    nullif(comments_applicability, ''),
                    nullif(comments_limitations, '')))
                ELSE trim(both ' | ' from concat_ws(' | ',
                    additional_notes,
                    nullif(comments_applicability, ''),
                    nullif(comments_limitations, '')))
            END
        WHERE activity_name IS NULL
    """)

    # ── 3. Enforce NOT NULL on required source columns ─────────────────────
    not_null_cols = [
        "activity_name", "emission_category", "ghg_scope",
        "ef_value", "ghg_species", "expressed_as_co2e", "ef_type",
        "numerator_unit", "denominator_unit",
        "geography_type",
        "reference_year",
        "source_organization", "data_origin",
        "calculation_method", "system_boundary",
        "status",
    ]
    for col in not_null_cols:
        op.alter_column("emission_factors", col, nullable=False)

    # status default + updated_at default
    op.execute("ALTER TABLE emission_factors ALTER COLUMN status SET DEFAULT 'active'")
    op.execute("ALTER TABLE emission_factors ALTER COLUMN updated_at SET DEFAULT now()")
    op.execute("ALTER TABLE emission_factors ALTER COLUMN updated_at SET NOT NULL")

    # ── 4. Drop target-only columns ────────────────────────────────────────
    target_only = [
        "source_activity_name", "canonical_activity_name", "activity_category",
        "unit",
        "ef_total_co2e", "ef_co2", "ef_ch4", "ef_n2o", "ef_pfc", "ef_sf6", "ef_nf3",
        "applicable_scopes", "lca_stages",
        "source_name", "source_type", "source_url",
        "validity_start", "validity_end",
        "geography_global", "geography_country", "geography_region",
        "confidence_score", "confidence_breakdown",
        "gwp_version",
        "supplier_name", "supplier_country", "supplier_sector", "supplier_epd_reference",
        "comments_applicability", "comments_limitations",
        "custom_tags", "additional_notes",
        # Replaced lifecycle flags
        "is_current", "is_superseded", "superseded_by_id", "superseded_reason",
        "migrated",
    ]
    for col in target_only:
        op.drop_column("emission_factors", col)

    # ── 5. Rename + drop old FK columns ────────────────────────────────────
    # The old `created_by` was a UUID FK to users. We moved it to
    # `created_by_user_id` in the UPDATE above, and now the source-style
    # text `created_by` label takes the name. Drop the original.
    op.drop_column("emission_factors", "created_by")
    op.drop_column("emission_factors", "last_edited_by")
    op.alter_column("emission_factors", "created_by_label", new_column_name="created_by")

    # superseded_reason gets re-added on the source schema side (legacy
    # column was already dropped above) — restore it as Text.
    op.add_column("emission_factors", sa.Column("superseded_reason", sa.Text(), nullable=True))

    # ── 6. Indexes: drop old, add source-schema ones ───────────────────────
    op.execute("DROP INDEX IF EXISTS efdb.ix_ef_canonical_name")
    op.execute("DROP INDEX IF EXISTS efdb.ix_ef_canonical_name_trgm")
    op.execute("DROP INDEX IF EXISTS efdb.ix_ef_canonical_trgm")
    op.execute("DROP INDEX IF EXISTS efdb.ix_ef_geography")
    op.execute("DROP INDEX IF EXISTS efdb.ix_ef_validity")
    op.execute("DROP INDEX IF EXISTS efdb.ix_ef_current")

    op.execute(
        "CREATE INDEX ix_ef_activity_name_trgm ON emission_factors "
        "USING gin (activity_name gin_trgm_ops)"
    )
    op.create_index("ix_ef_category", "emission_factors", ["emission_category"])
    op.create_index("ix_ef_scope", "emission_factors", ["ghg_scope"])
    op.create_index("ix_ef_country", "emission_factors", ["country_iso"])
    op.create_index("ix_ef_org", "emission_factors", ["source_organization"])
    op.create_index("ix_ef_year", "emission_factors", ["reference_year"])
    op.create_index("ix_ef_status", "emission_factors", ["status"])
    op.create_index("ix_ef_species", "emission_factors", ["ghg_species"])
    op.create_unique_constraint("uq_ef_ef_id", "emission_factors", ["ef_id"])

    # ── 7. Drop the legacy enums ───────────────────────────────────────────
    op.execute("DROP TYPE IF EXISTS sourcetype")
    op.execute("DROP TYPE IF EXISTS gwpversion")


def downgrade() -> None:
    # The schema swap is destructive (target columns and enums are dropped);
    # rolling back would require a full target-schema rebuild + restore of
    # the pre-swap-backup.json data. We deliberately do NOT auto-revert here.
    raise NotImplementedError(
        "Downgrade is not supported. Restore from "
        "backend/pre-swap-backup.json via a manual data load if needed."
    )
