from datetime import UTC, datetime
from decimal import Decimal

import pytest
from bale_price_alert.services.price_service import PriceService
from sqlalchemy import select

from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.infra.providers.base import PricePoint


@pytest.mark.anyio
async def test_save_price_updates_latest(db_session) -> None:
    session = db_session

    service = PriceService(session)

    test_asset_id = "test-asset-uuid"
    test_provider_id = "test-provider-uuid"

    pp = PricePoint(
        symbol="BTC",
        price=Decimal("50000.00"),
        observed_at=datetime.now(UTC),
    )

    await service.save_price(test_asset_id, test_provider_id, pp)

    stmt = select(LatestPrice).where(LatestPrice.asset_id == test_asset_id)
    res = await session.execute(stmt)
    latest = res.scalar_one()

    assert latest.price == Decimal("50000.00")
