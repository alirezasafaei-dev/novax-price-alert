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


class AssetUnit(str, Enum):
    """Supported price display / accounting units."""

    TOMAN = "IRT"
    IRR = "IRR"
    USDT = "USDT"
    BTC = "BTC"
    ETH = "ETH"
    TON = "TON"
    IRT = "IRT"  # alias for Toman, kept for backward compatibility


# Conversion factors to IRT (Toman). Extend as needed.
UNIT_TO_IRT_RATES: dict[str, float] = {
    AssetUnit.TOMAN: 1.0,
    AssetUnit.IRR: 1.0,
    AssetUnit.IRT: 1.0,
    AssetUnit.USDT: 50000.0,  # placeholder — real rate comes from price feed
    AssetUnit.BTC: 3_000_000_000.0,  # placeholder
    AssetUnit.ETH: 100_000_000.0,  # placeholder
    AssetUnit.TON: 150_000.0,  # placeholder
}


def unit_to_irt(amount: float, unit: str) -> float:
    """Convert an amount in the given unit to IRT (Toman)."""
    rate = UNIT_TO_IRT_RATES.get(unit, 1.0)
    return amount * rate


def irt_to_unit(amount_irt: float, unit: str) -> float:
    """Convert an amount in IRT (Toman) to the given unit."""
    rate = UNIT_TO_IRT_RATES.get(unit, 1.0)
    if rate == 0:
        return 0.0
    return amount_irt / rate
