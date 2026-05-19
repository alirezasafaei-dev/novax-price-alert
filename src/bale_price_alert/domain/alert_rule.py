from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from bale_price_alert.domain.enums import AlertCondition


class AlertRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "alert_rules"

    __table_args__ = (
        Index("ix_alert_rules_user_asset_active", "user_id", "asset_id", "is_active"),
    )

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

    condition_type: Mapped[AlertCondition] = mapped_column(
        String(10),
        nullable=False,
    )

    target_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    cooldown_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )

    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user = relationship("User")
    asset = relationship("Asset")
    alert_events = relationship(
        "AlertEvent",
        back_populates="alert_rule",
        cascade="all, delete-orphan",
    )
