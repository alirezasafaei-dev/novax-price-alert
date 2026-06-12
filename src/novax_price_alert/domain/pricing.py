from decimal import Decimal, InvalidOperation

DEFAULT_PRICE_UNIT = "IRT"
PRICE_QUANT = Decimal("0.00000001")


def to_persian_digits(value: int | float | str) -> str:
    """Convert Western digits to Persian digits."""
    persian_digits = {
        "0": "۰",
        "1": "۱",
        "2": "۲",
        "3": "۳",
        "4": "۴",
        "5": "۵",
        "6": "۶",
        "7": "۷",
        "8": "۸",
        "9": "۹",
    }
    result = str(value)
    for western, persian in persian_digits.items():
        result = result.replace(western, persian)
    return result

# ── Dynamic decimal precision per unit ────────────────────────────
# High-value units (IRT, TOMAN, IRR) → 0 decimals (prices shown as whole numbers)
# Mid-value units (USDT, DAI, major fiats) → up to 4 decimals
# Low-value units (BTC, ETH, low-price assets) → up to 8 decimals
UNIT_DECIMAL_PLACES: dict[str, int] = {
    # Iranian base — no decimals needed for display
    "IRT": 0,
    "IRR": 0,
    "TOMAN": 0,
    # Stablecoins — 2 decimals
    "USDT": 2,
    "DAI": 2,
    # Major fiats
    "EUR": 2,
    "GBP": 2,
    "AED": 2,
    "CNY": 2,
    "TRY": 2,
    "JPY": 2,
    "KWD": 3,
    "SAR": 2,
    "CAD": 2,
    "AUD": 2,
    "CHF": 2,
    "INR": 2,
    "PKR": 2,
    # Cryptos — higher precision
    "BTC": 8,
    "ETH": 6,
    "TON": 4,
    "SOL": 4,
    "BNB": 4,
    "XRP": 4,
    "DOGE": 4,
    "ADA": 4,
}

# Thresholds: if the integral part has more digits than this, reduce decimals
# e.g. BTC at 65000.5 → show 65000.5 not 65000.50000000
LARGE_VALUE_THRESHOLD_DIGITS = 5


def _decimal_places_for(unit: str, value: Decimal) -> int:
    """Determine the appropriate number of decimal places for a price display.
    - Uses the unit's default precision.
    - Reduces precision when the integral part is large (≥100000).
    - Never exceeds 8 or goes below 0.
    """
    base_places = UNIT_DECIMAL_PLACES.get(unit, 4)
    # Count integral digits
    integral = abs(int(value.to_integral_value(rounding="ROUND_FLOOR")))
    if integral == 0:
        # Value < 1: show full precision but cap at 8
        return min(base_places, 8)
    digits = len(str(integral))
    if digits >= LARGE_VALUE_THRESHOLD_DIGITS:
        # Very large values: reduce decimals to avoid clutter
        return max(0, min(base_places, 8 - (digits - LARGE_VALUE_THRESHOLD_DIGITS)))
    return min(base_places, 8)


def normalize_price(value: Decimal | int | str) -> Decimal:
    try:
        price = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("price must be a positive numeric value") from exc

    if price <= 0:
        raise ValueError("price must be greater than zero")
    return price.quantize(PRICE_QUANT)


def format_price(value: Decimal, unit: str = DEFAULT_PRICE_UNIT, use_persian: bool = False) -> str:
    """Format price with appropriate decimal places and optional Persian digits."""
    normalized = normalize_price(value)
    places = _decimal_places_for(unit, normalized)

    # Build the quantizer dynamically: Decimal("1") for 0 places, Decimal("0.01") for 2, etc.
    if places <= 0:
        quantizer = Decimal("1")
    else:
        quantizer = Decimal("1").scaleb(-places)  # 10^(-places)

    rounded = normalized.quantize(quantizer)
    # If the result is a whole number, don't show trailing zeros
    if rounded == rounded.to_integral():
        rounded = rounded.to_integral()

    formatted = f"{rounded:,} {unit}"
    if use_persian:
        formatted = to_persian_digits(formatted)
    return formatted
