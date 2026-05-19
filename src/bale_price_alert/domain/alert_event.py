from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from bale_price_alert.domain.enums import AlertEventStatus


class AlertEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "alert_events"

    alert_rule_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("alert_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    triggered_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
    )

    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    status: Mapped[AlertEventStatus] = mapped_column(
        String(20),
        nullable=False,
        default=AlertEventStatus.PENDING,
    )

    error_message: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    alert_rule = relationship("AlertRule", back_populates="alert_events")
