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
    EUR = "EUR"  # Euro
    AED = "AED"  # UAE Dirham
    CNY = "CNY"  # Chinese Yuan
    GBP = "GBP"  # British Pound
    TRY = "TRY"  # Turkish Lira
    JPY = "JPY"  # Japanese Yen
    KWD = "KWD"  # Kuwaiti Dinar
    SAR = "SAR"  # Saudi Riyal
    CAD = "CAD"  # Canadian Dollar
    AUD = "AUD"  # Australian Dollar
    CHF = "CHF"  # Swiss Franc
    INR = "INR"  # Indian Rupee
    PKR = "PKR"  # Pakistani Rupee
    DAI = "DAI"  # DAI Stablecoin
    SOL = "SOL"  # Solana
    BNB = "BNB"  # Binance Coin
    XRP = "XRP"  # Ripple
    DOGE = "DOGE"  # Dogecoin
    ADA = "ADA"  # Cardano


# Conversion factors to IRT (Toman). Extend as needed.
# These are approximate placeholder rates — real rates come from price feed.
UNIT_TO_IRT_RATES: dict[str, float] = {
    # Iranian base currencies
    AssetUnit.TOMAN: 1.0,
    AssetUnit.IRR: 1.0,
    AssetUnit.IRT: 1.0,
    # Stablecoins
    AssetUnit.USDT: 50000.0,
    AssetUnit.DAI: 50000.0,
    # Major cryptocurrencies
    AssetUnit.BTC: 3_000_000_000.0,
    AssetUnit.ETH: 100_000_000.0,
    AssetUnit.TON: 150_000.0,
    AssetUnit.SOL: 7_500_000.0,
    AssetUnit.BNB: 30_000_000.0,
    AssetUnit.XRP: 30_000.0,
    AssetUnit.DOGE: 10_000.0,
    AssetUnit.ADA: 20_000.0,
    # Fiat currencies
    AssetUnit.GBP: 700_000.0,
    AssetUnit.EUR: 600_000.0,
    AssetUnit.AED: 150_000.0,
    AssetUnit.CNY: 75_000.0,
    AssetUnit.TRY: 15_000.0,
    AssetUnit.JPY: 4_000.0,
    AssetUnit.KWD: 1_800_000.0,
    AssetUnit.SAR: 140_000.0,
    AssetUnit.CAD: 380_000.0,
    AssetUnit.AUD: 350_000.0,
    AssetUnit.CHF: 580_000.0,
    AssetUnit.INR: 6_500.0,
    AssetUnit.PKR: 2_000.0,
}


def unit_to_irt(amount: float, unit: str) -> float:
    """Convert an amount in the given unit to IRT (Toman).
    Falls back to 1.0 rate for unknown units (no conversion).
    """
    rate = UNIT_TO_IRT_RATES.get(unit, 1.0)
    return amount * rate


def irt_to_unit(amount_irt: float, unit: str) -> float:
    """Convert an amount in IRT (Toman) to the given unit.
    Falls back to 1.0 rate for unknown units (no conversion).
    """
    rate = UNIT_TO_IRT_RATES.get(unit, 1.0)
    if rate == 0:
        return 0.0
    return amount_irt / rate


def convert_units(amount: float, from_unit: str, to_unit: str) -> float:
    """Convert an amount from one unit to another via IRT as intermediate.
    Returns the converted amount, or the original amount if conversion is not available.
    """
    if from_unit == to_unit:
        return amount
    amount_irt = unit_to_irt(amount, from_unit)
    return irt_to_unit(amount_irt, to_unit)
