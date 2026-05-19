from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from bale_price_alert.domain.enums import AlertCondition


class Alert(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "alerts"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    condition: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
    )
    target_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    cooldown_seconds: Mapped[int] = mapped_column(
        nullable=False,
        default=3600,
    )
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user = relationship("User")
    asset = relationship("Asset")

    @staticmethod
    def normalize_condition(condition: AlertCondition) -> str:
        return condition.value
