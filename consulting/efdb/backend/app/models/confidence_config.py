import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ConfidenceWeightConfig(Base):
    """
    Stores the active confidence score weight configuration.
    Only one row should have is_active=True at any time.
    Previous configs are kept for historical reference.
    """
    __tablename__ = "confidence_weight_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Weights stored as JSON for flexibility
    # Default structure:
    # {
    #   "source_type": {
    #     "max_points": 35,
    #     "values": {
    #       "Government / Regulatory body": 35,
    #       "Intergovernmental body": 35,
    #       "GHG Protocol / Industry standard": 28,
    #       "Commercial LCA database export": 22,
    #       "Peer-reviewed publication": 28,
    #       "Industry association": 16,
    #       "Supplier-provided / EPD": 12,
    #       "Internal estimate": 5,
    #       "Other": 5
    #     }
    #   },
    #   "audited": {"max_points": 20, "audited": 20, "published": 10, "none": 0},
    #   "geography": {"max_points": 25, "country_region": 25, "country": 20, "regional_bloc": 12, "global": 5},
    #   "recency": {"max_points": 20, "points_per_year": 2}
    # }
    weights: Mapped[dict] = mapped_column(JSON, nullable=False)

    label: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. "Default v1", "Updated Apr 2026"
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @staticmethod
    def default_weights() -> dict:
        return {
            "source_type": {
                "max_points": 35,
                "values": {
                    "Government / Regulatory body": 35,
                    "Intergovernmental body": 35,
                    "GHG Protocol / Industry standard": 28,
                    "Commercial LCA database export": 22,
                    "Peer-reviewed publication": 28,
                    "Industry association": 16,
                    "Supplier-provided / EPD": 12,
                    "Internal estimate": 5,
                    "Other": 5,
                },
            },
            "audited": {"max_points": 20, "audited": 20, "published": 10, "none": 0},
            "geography": {
                "max_points": 25,
                "country_region": 25,
                "country": 20,
                "regional_bloc": 12,
                "global": 5,
            },
            "recency": {"max_points": 20, "points_per_year_decay": 2},
        }
