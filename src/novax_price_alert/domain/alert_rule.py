from datetime import datetime
from decimal import Decimal
from typing import ClassVar

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novax_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from novax_price_alert.domain.enums import AlertCondition, AlertLifecycleState


class InvalidAlertTransitionError(ValueError):
    def __init__(
        self,
        current_state: AlertLifecycleState | str,
        next_state: AlertLifecycleState | str,
    ) -> None:
        super().__init__(f"invalid alert transition from {current_state!s} to {next_state!s}")
        self.current_state = str(current_state)
        self.next_state = str(next_state)


class AlertRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "alert_rules"

    VALID_TRANSITIONS: ClassVar[dict[AlertLifecycleState, set[AlertLifecycleState]]] = {
        AlertLifecycleState.DRAFT: {
            AlertLifecycleState.AWAITING_CONDITION,
            AlertLifecycleState.CANCELLED,
        },
        AlertLifecycleState.AWAITING_CONDITION: {
            AlertLifecycleState.AWAITING_TARGET_PRICE,
            AlertLifecycleState.CANCELLED,
        },
        AlertLifecycleState.AWAITING_TARGET_PRICE: {
            AlertLifecycleState.PENDING_CONFIRMATION,
            AlertLifecycleState.AWAITING_CONDITION,
            AlertLifecycleState.CANCELLED,
        },
        AlertLifecycleState.PENDING_CONFIRMATION: {
            AlertLifecycleState.ACTIVE,
            AlertLifecycleState.AWAITING_TARGET_PRICE,
            AlertLifecycleState.CANCELLED,
        },
        AlertLifecycleState.ACTIVE: {
            AlertLifecycleState.TRIGGERED,
            AlertLifecycleState.PAUSED,
            AlertLifecycleState.CANCELLED,
            AlertLifecycleState.FAILED,
        },
        AlertLifecycleState.TRIGGERED: {
            AlertLifecycleState.DELIVERY_IN_PROGRESS,
            AlertLifecycleState.FAILED,
        },
        AlertLifecycleState.DELIVERY_IN_PROGRESS: {
            AlertLifecycleState.DELIVERED,
            AlertLifecycleState.FAILED,
        },
        AlertLifecycleState.DELIVERED: set(),
        AlertLifecycleState.PAUSED: {AlertLifecycleState.ACTIVE, AlertLifecycleState.CANCELLED},
        AlertLifecycleState.CANCELLED: set(),
        AlertLifecycleState.FAILED: {AlertLifecycleState.ACTIVE, AlertLifecycleState.CANCELLED},
    }

    __table_args__ = (
        Index("ix_alert_rules_user_asset_active", "user_id", "asset_id", "is_active"),
        Index(
            "ix_alert_rules_match",
            "asset_id",
            "is_active",
            "lifecycle_state",
            "condition_type",
            "target_price",
        ),
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

    target_price_display_unit: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="IRT",
    )

    display_asset_name_at_creation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    lifecycle_state: Mapped[AlertLifecycleState] = mapped_column(
        String(32),
        nullable=False,
        default=AlertLifecycleState.PENDING_CONFIRMATION,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
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

    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    asset = relationship("Asset")
    alert_events = relationship(
        "AlertEvent",
        back_populates="alert_rule",
        cascade="all, delete-orphan",
    )

    @property
    def canonical_asset_id(self) -> str:
        return self.asset_id

    def transition_to(self, next_state: AlertLifecycleState) -> None:
        current_state = AlertLifecycleState(self.lifecycle_state)
        if next_state == current_state:
            return
        if next_state not in self.VALID_TRANSITIONS[current_state]:
            raise InvalidAlertTransitionError(current_state, next_state)
        self.lifecycle_state = next_state
        self.is_active = next_state == AlertLifecycleState.ACTIVE
