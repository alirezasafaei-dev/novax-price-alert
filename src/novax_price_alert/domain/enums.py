from enum import Enum


class AlertCondition(str, Enum):
    ABOVE = "above"
    BELOW = "below"


class AlertLifecycleState(str, Enum):
    DRAFT = "draft"
    AWAITING_CONDITION = "awaiting_condition"
    AWAITING_TARGET_PRICE = "awaiting_target_price"
    PENDING_CONFIRMATION = "pending_confirmation"
    ACTIVE = "active"
    TRIGGERED = "triggered"
    DELIVERY_IN_PROGRESS = "delivery_in_progress"
    DELIVERED = "delivered"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    FAILED = "failed"


class AlertEventStatus(str, Enum):
    PENDING = "pending"
    DELIVERY_IN_PROGRESS = "delivery_in_progress"
    SENT = "sent"
    FAILED = "failed"


class PriceFreshness(str, Enum):
    FRESH = "fresh"
    STALE = "stale"
    UNAVAILABLE = "unavailable"
