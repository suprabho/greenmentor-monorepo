"""EPD ingestion: document_type on source_documents; supplier/EPD provenance on emission_factors.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET search_path TO efdb, public")
    op.add_column(
        "source_documents",
        sa.Column("document_type", sa.Text(), nullable=False, server_default="generic"),
    )
    op.add_column("emission_factors", sa.Column("source_type", sa.Text(), nullable=True))
    op.add_column("emission_factors", sa.Column("supplier_name", sa.Text(), nullable=True))
    op.add_column("emission_factors", sa.Column("supplier_country", sa.String(3), nullable=True))
    op.add_column("emission_factors", sa.Column("supplier_sector", sa.Text(), nullable=True))
    op.add_column("emission_factors", sa.Column("supplier_epd_reference", sa.Text(), nullable=True))


def downgrade() -> None:
    op.execute("SET search_path TO efdb, public")
    op.drop_column("emission_factors", "supplier_epd_reference")
    op.drop_column("emission_factors", "supplier_sector")
    op.drop_column("emission_factors", "supplier_country")
    op.drop_column("emission_factors", "supplier_name")
    op.drop_column("emission_factors", "source_type")
    op.drop_column("source_documents", "document_type")
