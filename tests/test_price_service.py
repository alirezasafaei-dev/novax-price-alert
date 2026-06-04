from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.price_query_service import PriceQueryService
from novax_price_alert.application.services.price_service import PriceService
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.price_snapshot import PriceSnapshot
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


@pytest.mark.anyio
async def test_price_history_returns_recent_snapshots_newest_first(
    db_session: AsyncSession,
) -> None:
    session = db_session
    asset = Asset(id="asset-history-usd", symbol="USD_IRT", name="US Dollar", unit="IRT")
    provider = Provider(id="provider-history-tgju", slug="tgju_scrape", name="TGJU", priority=1)
    older = PriceSnapshot(
        asset_id=asset.id,
        provider_id=provider.id,
        price=Decimal("1700000"),
        observed_at=datetime(2026, 6, 4, 10, 0, tzinfo=timezone.utc),
    )
    newer = PriceSnapshot(
        asset_id=asset.id,
        provider_id=provider.id,
        price=Decimal("1710000"),
        observed_at=datetime(2026, 6, 4, 10, 10, tzinfo=timezone.utc),
    )
    other_asset = Asset(id="asset-history-eur", symbol="EUR_IRT", name="Euro", unit="IRT")
    other_snapshot = PriceSnapshot(
        asset_id=other_asset.id,
        provider_id=provider.id,
        price=Decimal("1800000"),
        observed_at=datetime(2026, 6, 4, 10, 20, tzinfo=timezone.utc),
    )
    session.add_all([asset, other_asset, provider, older, newer, other_snapshot])
    await session.commit()

    rows = await PriceQueryService(session).price_history("USD_IRT", limit=2)

    assert [row.price for row in rows] == [Decimal("1710000"), Decimal("1700000")]
    assert {row.symbol for row in rows} == {"USD_IRT"}
    assert rows[0].provider_slug == "tgju_scrape"
    assert rows[0].display_unit == "IRT"


@pytest.mark.anyio
async def test_price_history_respects_limit(db_session: AsyncSession) -> None:
    session = db_session
    asset = Asset(id="asset-history-limit", symbol="BTC", name="Bitcoin", unit="USDT")
    provider = Provider(id="provider-history-binance", slug="binance", name="Binance", priority=1)
    snapshots = [
        PriceSnapshot(
            asset_id=asset.id,
            provider_id=provider.id,
            price=Decimal(str(60000 + index)),
            observed_at=datetime(2026, 6, 4, 10, index, tzinfo=timezone.utc),
        )
        for index in range(3)
    ]
    session.add_all([asset, provider, *snapshots])
    await session.commit()

    rows = await PriceQueryService(session).price_history("BTC", limit=1)

    assert len(rows) == 1
    assert rows[0].price == Decimal("60002")
