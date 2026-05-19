import random
from datetime import UTC, datetime
from decimal import Decimal

from bale_price_alert.infra.providers.base import BasePriceProvider, PricePoint


class MockPriceProvider(BasePriceProvider):
    @property
    def slug(self) -> str:
        return "mock"

    async def get_price(self, symbol: str) -> PricePoint:
        # ایجاد یک قیمت رندوم حول ۱۰۰ برای تست
        base_price = 100.0
        variation = random.uniform(-5, 5)
        
        return PricePoint(
            symbol=symbol,
            price=Decimal(f"{base_price + variation:.2f}"),
            observed_at=datetime.now(UTC),
            raw_data={"source": "mock_generator", "version": "1.0"}
        )
