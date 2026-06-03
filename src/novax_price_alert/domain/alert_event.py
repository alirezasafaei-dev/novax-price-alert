from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novax_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from novax_price_alert.domain.enums import AlertEventStatus


class AlertEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "alert_events"

    __table_args__ = (
        UniqueConstraint("event_id", name="uq_alert_events_event_id"),
        UniqueConstraint("idempotency_key", name="uq_alert_events_idempotency_key"),
        UniqueConstraint("alert_rule_id", "triggered_at", name="uq_alert_event_rule_triggered_at"),
        Index("ix_alert_events_status_created", "status", "created_at"),
    )

    alert_rule_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("alert_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)

    triggered_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
    )

    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    status: Mapped[AlertEventStatus] = mapped_column(
        String(32),
        nullable=False,
        default=AlertEventStatus.PENDING,
    )

    worker_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    error_message: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    telegram_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    alert_rule = relationship("AlertRule", back_populates="alert_events")
