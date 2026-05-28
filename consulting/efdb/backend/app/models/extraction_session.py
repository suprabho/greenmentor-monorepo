import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, JSON, ForeignKey, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import enum


class SessionStatus(str, enum.Enum):
    pending = "pending"
    extracting = "extracting"
    awaiting_review = "awaiting_review"
    in_review = "in_review"
    completed = "completed"
    failed = "failed"


class ExtractionSession(Base):
    __tablename__ = "extraction_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_documents.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(SAEnum(SessionStatus), default=SessionStatus.pending)

    # Tables/sections the user selected to extract
    selected_sections: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Full extraction result — JSON array of extracted records (before review)
    extraction_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Review progress — which record indices have been actioned
    review_progress: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    # e.g. {"approved": [0,1,3], "rejected": [2], "pending": [4,5,...]}

    # Counts
    total_extracted: Mapped[int] = mapped_column(Integer, default=0)
    total_approved: Mapped[int] = mapped_column(Integer, default=0)
    total_rejected: Mapped[int] = mapped_column(Integer, default=0)

    # Error info
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RejectedExtraction(Base):
    """Archive of records rejected during review — preserves provenance."""
    __tablename__ = "rejected_extractions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("extraction_sessions.id"), nullable=False)
    rejected_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    rejected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict] = mapped_column(JSON, nullable=False)  # snapshot of what was extracted
