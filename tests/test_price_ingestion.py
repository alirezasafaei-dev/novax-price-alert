from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.infra.providers.base import BasePriceProvider, PricePoint
from novax_price_alert.services.price_ingestion import PriceIngestionService


class PartialProvider(BasePriceProvider):
    @property
    def slug(self) -> str:
        return "partial"

    async def get_price(self, symbol: str) -> PricePoint:
        prices = await self.get_prices([symbol])
        return prices[symbol]

    async def get_prices(self, symbols: list[str]) -> dict[str, PricePoint]:
        now = datetime.now(timezone.utc)
        return {
            "USD_IRT": PricePoint(
                symbol="USD_IRT",
                price=Decimal("1700000"),
                observed_at=now,
                fetched_at=now,
            ),
            "USDT_IRT": PricePoint(
                symbol="USDT_IRT",
                price=Decimal("1710000"),
                observed_at=now,
                fetched_at=now,
            ),
        }


@pytest.mark.anyio
async def test_ingest_all_assets_skips_missing_symbols_from_provider(db_session: AsyncSession) -> None:
    session = db_session
    session.add_all(
        [
            Asset(id="a1", symbol="USD_IRT", name="USD", enabled=True),
            Asset(id="a2", symbol="USDT_IRT", name="USDT", enabled=True),
            Asset(id="a3", symbol="BTC_USDT", name="BTC", enabled=True),
        ]
    )
    await session.commit()

    service = PriceIngestionService(session=session, provider=PartialProvider())
    count = await service.ingest_all_assets()

    assert count == 2

    result = await session.execute(select(LatestPrice))
    prices = result.scalars().all()
    assert len(prices) == 2
