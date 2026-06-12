"""Codified policies from CONTRACTS_AND_POLICIES.md for runtime use.

These provide constants and helpers to enforce the contracts in code.
"""

from datetime import timedelta
from decimal import Decimal
from enum import Enum


# From Asset Identity Policy
class AssetUnit(str, Enum):
    TOMAN = "IRT"
    USDT = "USDT"
    IRR = "IRR"
    TETHER = "USDT"


DEFAULT_UNIT_IRANIAN = AssetUnit.TOMAN
DEFAULT_UNIT_CRYPTO = AssetUnit.USDT

# From Pricing Presentation Policy
THOUSAND_SEPARATOR = ","

# Decimal precision by category
DECIMALS_CURRENCY = 0  # IRT / Toman — no decimals
DECIMALS_GOLD = 0  # IRT / Toman — no decimals
DECIMALS_COIN = 0  # IRT / Toman — no decimals
DECIMALS_CRYPTO_HIGH = 2  # USDT — high-value crypto (BTC, ETH)
DECIMALS_CRYPTO_LOW = 4  # USDT — low-value crypto (< 1 USDT)
DECIMALS_CRYPTO_MID = 6  # USDT — mid-value crypto (1-100 USDT)

# Thresholds for switching precision
CRYPTO_LOW_THRESHOLD = Decimal("1")  # < 1 USDT → 4 decimals
CRYPTO_MID_THRESHOLD = Decimal("100")  # 1-100 USDT → 6 decimals
# > 100 USDT → 2 decimals


def _crypto_decimals(price: Decimal) -> int:
    """Return decimal places for a crypto price in USDT based on its magnitude."""
    abs_price = abs(price)
    if abs_price < CRYPTO_LOW_THRESHOLD:
        return DECIMALS_CRYPTO_LOW
    if abs_price < CRYPTO_MID_THRESHOLD:
        return DECIMALS_CRYPTO_MID
    return DECIMALS_CRYPTO_HIGH


def format_price(price: Decimal, unit: str, category: str = "") -> str:
    """Format price according to policy: readable, separators, appropriate decimals.

    Decimal precision is driven by the asset category and price magnitude:
    - IRT/Toman prices: no decimals (integer)
    - USDT crypto >= 100: 2 decimals
    - USDT crypto 1-100: 6 decimals
    - USDT crypto < 1: 4 decimals
    """
    if unit in (AssetUnit.TOMAN, AssetUnit.IRR, "IRT", "IRR"):
        return f"{int(price):,}"

    if unit == AssetUnit.USDT or unit == "USDT":
        decimals = _crypto_decimals(price)
        return f"{float(price):,.{decimals}f}"

    # Fallback: 2 decimals
    return f"{float(price):,.2f}"


def convert_to_toman(price_usdt: Decimal, usdt_rate: Decimal) -> Decimal:
    """Convert a USDT-denominated price to Toman using the provided rate."""
    return (price_usdt * usdt_rate).quantize(Decimal("1"))


def convert_from_toman(price_toman: Decimal, usdt_rate: Decimal) -> Decimal:
    """Convert a Toman-denominated price back to USDT using the provided rate."""
    if usdt_rate == 0:
        return Decimal("0")
    return (price_toman / usdt_rate).quantize(Decimal("0.00000001"))


# From Freshness Policy
class FreshnessThresholds:
    EXPECTED_UPDATE_CADENCE = timedelta(minutes=5)
    FRESH = timedelta(minutes=10)
    STALE = timedelta(minutes=30)
    UNAVAILABLE = timedelta(hours=2)


# From Alert Flow and Lifecycle - reexport or use from enums, but here for doc
# States are in domain/enums.py


# Helper to validate unit per policy
def is_valid_unit_for_asset(unit: str, is_crypto: bool = False) -> bool:
    if is_crypto:
        return unit == AssetUnit.USDT
    return unit in (AssetUnit.TOMAN, AssetUnit.IRR)
