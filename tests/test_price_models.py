from datetime import UTC, datetime
from decimal import Decimal

from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.domain.price_snapshot import PriceSnapshot


def test_price_models_creation() -> None:
    snapshot = PriceSnapshot(
        asset_id="asset1",
        provider_id="provider1",
        price=Decimal("100"),
        observed_at=datetime.now(UTC),
        raw_data=None,
    )

    latest = LatestPrice(
        asset_id="asset1",
        provider_id="provider1",
        price=Decimal("100"),
        observed_at=datetime.now(UTC),
    )

    assert snapshot.price == Decimal("100")
    assert latest.asset_id == "asset1"
