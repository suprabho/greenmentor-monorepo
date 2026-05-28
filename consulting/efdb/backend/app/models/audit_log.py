import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import enum


class AuditAction(str, enum.Enum):
    record_created = "record_created"
    record_edited = "record_edited"
    record_deleted = "record_deleted"
    record_approved = "record_approved"
    record_rejected = "record_rejected"
    record_superseded = "record_superseded"
    conflict_flagged = "conflict_flagged"
    conflict_resolved = "conflict_resolved"
    confidence_recalculated = "confidence_recalculated"
    review_session_resumed = "review_session_resumed"
    version_restored = "version_restored"


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    action: Mapped[AuditAction] = mapped_column(SAEnum(AuditAction), nullable=False, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    emission_factor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("emission_factors.id"), nullable=True, index=True)
    extraction_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("extraction_sessions.id"), nullable=True)

    # For record_edited: {"field": "ef_total_co2e", "old": 2.67, "new": 2.68}
    # For confidence_recalculated: {"old_score": 74, "new_score": 81, "records_affected": 143}
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
