from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.price_query_service import PriceQueryService
from novax_price_alert.application.services.price_service import PriceService
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.provider import Provider
from novax_price_alert.infra.providers.base import PricePoint


@pytest.mark.anyio
async def test_save_price_updates_latest(db_session: AsyncSession) -> None:
    session = db_session

    service = PriceService(session)

    test_asset_id = "test-asset-uuid"
    test_provider_id = "test-provider-uuid"

    pp = PricePoint(
        symbol="BTC",
        price=Decimal("50000.00"),
        observed_at=datetime.now(timezone.utc),
    )

    await service.save_price(test_asset_id, test_provider_id, pp)

    stmt = select(LatestPrice).where(LatestPrice.asset_id == test_asset_id)
    res = await session.execute(stmt)
    latest = res.scalar_one()

    assert latest.price == Decimal("50000.00")


@pytest.mark.anyio
async def test_latest_prices_returns_provider_slug(db_session: AsyncSession) -> None:
    session = db_session
    observed_at = datetime.now(timezone.utc)
    asset = Asset(id="asset-1", symbol="USD_IRT", name="US Dollar")
    provider = Provider(id="provider-1", slug="tgju_scrape", name="TGJU Scrape", priority=8)
    latest = LatestPrice(
        asset_id=asset.id,
        provider_id=provider.id,
        price=Decimal("1704850"),
        observed_at=observed_at,
    )
    session.add_all([asset, provider, latest])
    await session.commit()

    rows = await PriceQueryService(session).latest_prices("USD_IRT")

    assert len(rows) == 1
    assert rows[0].provider_slug == "tgju_scrape"


@pytest.mark.anyio
async def test_latest_prices_returns_display_unit(db_session: AsyncSession) -> None:
    session = db_session
    observed_at = datetime.now(timezone.utc)
    asset = Asset(id="asset-usdt", symbol="USDT", name="Tether", unit="USDT")
    provider = Provider(id="provider-binance", slug="binance", name="Binance", priority=1)
    latest = LatestPrice(
        asset_id=asset.id,
        provider_id=provider.id,
        price=Decimal("1.00"),
        observed_at=observed_at,
    )
    session.add_all([asset, provider, latest])
    await session.commit()

    rows = await PriceQueryService(session).latest_prices("USDT")

    assert len(rows) == 1
    assert rows[0].display_unit == "USDT"
