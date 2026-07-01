import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EnvirondecWatch(Base):
    """A saved EnvironDec search. A scheduled job re-runs it, and newly-published
    EPDs matching the criteria are either auto-ingested or dropped into the
    review queue (`EnvirondecQueueItem`) depending on `mode`."""

    __tablename__ = "environdec_watches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Search criteria (mirrors app.services.environdec.search kwargs).
    query: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_number: Mapped[str | None] = mapped_column(Text, nullable=True)
    geo: Mapped[str | None] = mapped_column(String(8), nullable=True)
    classific: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "queue" → new hits await one-click approval; "auto" → ingested straight
    # into a review session (still no DB write until committed).
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="queue", server_default="queue")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    # Registration numbers already seen, so each run only surfaces new ones.
    seen_reg_nos: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class EnvirondecQueueItem(Base):
    """A new EPD surfaced by a watch, awaiting one-click ingest (queue mode).

    Carries the full flattened Data Hub hit so ingestion needs no re-search —
    it goes straight to enrich → map → review session."""

    __tablename__ = "environdec_queue_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    watch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("environdec_watches.id"), nullable=False)

    datahub_uuid: Mapped[str] = mapped_column(String(64), nullable=False)
    registration_number: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner: Mapped[str | None] = mapped_column(Text, nullable=True)
    geo: Mapped[str | None] = mapped_column(String(8), nullable=True)
    classific: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The flattened search hit (input to app.services.environdec.enrich_and_map).
    hit: Mapped[dict] = mapped_column(JSON, nullable=False)

    # "pending" | "ingested" | "dismissed"
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    # Set once ingested — links to the review session created for it.
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("extraction_sessions.id"), nullable=True)

    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    actioned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
