import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    original_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # "generic" | "epd" — drives which extraction prompts are used
    document_type: Mapped[str] = mapped_column(Text, nullable=False, default="generic", server_default="generic")
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)  # local path or object key
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # Extraction cost tracking
    estimated_tokens: Mapped[int | None] = mapped_column(nullable=True)
    actual_tokens_used: Mapped[int | None] = mapped_column(nullable=True)
    estimated_cost_usd: Mapped[float | None] = mapped_column(nullable=True)
