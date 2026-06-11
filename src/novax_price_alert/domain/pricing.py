from decimal import Decimal, InvalidOperation

DEFAULT_PRICE_UNIT = "IRT"
PRICE_QUANT = Decimal("0.00000001")


def normalize_price(value: Decimal | int | str) -> Decimal:
    try:
        price = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("price must be a positive numeric value") from exc

    if price <= 0:
        raise ValueError("price must be greater than zero")
    return price.quantize(PRICE_QUANT)


def format_price(value: Decimal, unit: str = DEFAULT_PRICE_UNIT) -> str:
    normalized = normalize_price(value)
    whole = (
        normalized.quantize(Decimal("1")) if normalized == normalized.to_integral() else normalized
    )
    return f"{whole:,} {unit}"
