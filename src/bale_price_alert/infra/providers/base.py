from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class PricePoint(BaseModel):
    symbol: str
    price: Decimal
    observed_at: datetime
    raw_data: dict[str, Any] | None = None


class BasePriceProvider(ABC):
    @property
    @abstractmethod
    def slug(self) -> str:
        """Unique identifier for the provider (e.g., 'binance', 'mock')."""
        pass

    @abstractmethod
    async def get_price(self, symbol: str) -> PricePoint:
        """Fetch current price for a given symbol."""
        pass
