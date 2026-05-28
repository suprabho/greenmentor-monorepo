"""Add source_url column missed in 0002 swap.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET search_path TO efdb, public")
    op.add_column("emission_factors", sa.Column("source_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.execute("SET search_path TO efdb, public")
    op.drop_column("emission_factors", "source_url")
