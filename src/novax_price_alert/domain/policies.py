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


DEFAULT_UNIT_IRANIAN = AssetUnit.TOMAN
DEFAULT_UNIT_CRYPTO = AssetUnit.USDT

# From Pricing Presentation Policy
THOUSAND_SEPARATOR = ","
DECIMALS_IRANIAN = 0  # for toman
DECIMALS_CRYPTO = 2  # for USDT typically


def format_price(price: Decimal, unit: str) -> str:
    """Format price according to policy: readable, separators, appropriate decimals."""
    if unit == AssetUnit.TOMAN:
        return f"{int(price):,}"
    else:
        return f"{float(price):,.{DECIMALS_CRYPTO}f}"


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
    return unit == AssetUnit.TOMAN
