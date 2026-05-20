from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class LatestPriceItemOut(BaseModel):
    asset_code: str
    asset_name: str
    price_value: Decimal
    currency_code: str
    provider: str
    fetched_at: datetime

class LatestPricesOut(BaseModel):
    items: list[LatestPriceItemOut]
