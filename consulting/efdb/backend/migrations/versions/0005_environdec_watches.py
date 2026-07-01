"""EnvironDec watches + queue: saved searches and surfaced-EPD queue for
on-demand / watched ingestion from the International EPD System.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET search_path TO efdb, public")

    op.create_table(
        "environdec_watches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("query", sa.Text(), nullable=True),
        sa.Column("owner", sa.Text(), nullable=True),
        sa.Column("registration_number", sa.Text(), nullable=True),
        sa.Column("geo", sa.String(8), nullable=True),
        sa.Column("classific", sa.Text(), nullable=True),
        sa.Column("mode", sa.String(16), nullable=False, server_default="queue"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("seen_reg_nos", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    op.create_table(
        "environdec_queue_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("watch_id", sa.Uuid(), sa.ForeignKey("environdec_watches.id"), nullable=False),
        sa.Column("datahub_uuid", sa.String(64), nullable=False),
        sa.Column("registration_number", sa.Text(), nullable=True),
        sa.Column("product_name", sa.Text(), nullable=True),
        sa.Column("owner", sa.Text(), nullable=True),
        sa.Column("geo", sa.String(8), nullable=True),
        sa.Column("classific", sa.Text(), nullable=True),
        sa.Column("hit", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("extraction_sessions.id"), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("actioned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_environdec_queue_watch", "environdec_queue_items", ["watch_id"])
    op.create_index("ix_environdec_queue_status", "environdec_queue_items", ["status"])


def downgrade() -> None:
    op.execute("SET search_path TO efdb, public")
    op.drop_index("ix_environdec_queue_status", table_name="environdec_queue_items")
    op.drop_index("ix_environdec_queue_watch", table_name="environdec_queue_items")
    op.drop_table("environdec_queue_items")
    op.drop_table("environdec_watches")
