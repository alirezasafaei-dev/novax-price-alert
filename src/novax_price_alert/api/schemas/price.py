from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class LatestPriceItemOut(BaseModel):
    asset_code: str
    asset_name: str
    price_value: Decimal
    currency_code: str
    display_unit: str
    provider: str
    fetched_at: datetime
    is_stale: bool = False
    freshness: str = "fresh"  # fresh | stale | unavailable (from policy)


class LatestPricesOut(BaseModel):
    items: list[LatestPriceItemOut]


class PriceHistoryItemOut(BaseModel):
    asset_code: str
    asset_name: str
    price_value: Decimal
    currency_code: str
    display_unit: str
    provider: str
    observed_at: datetime


class PriceHistoryOut(BaseModel):
    items: list[PriceHistoryItemOut]


class SuggestionItemOut(BaseModel):
    asset_code: str
    asset_name: str
    price_value: Decimal
    display_unit: str
    change_pct: float | None = None  # simple recent % change for "smart"
    volatility: float | None = None
    reason: str = "unwatched"


class SuggestionsOut(BaseModel):
    items: list[SuggestionItemOut]
