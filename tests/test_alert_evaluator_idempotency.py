from datetime import UTC, datetime
from decimal import Decimal

import pytest

from bale_price_alert.domain.alert_rule import AlertRule
from bale_price_alert.domain.enums import AlertCondition
from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.services.alert_evaluator import AlertEvaluatorService


@pytest.mark.anyio
async def test_evaluator_does_not_duplicate_event_for_same_timestamp(db_session) -> None:
    session = db_session
    observed_at = datetime.now(UTC)

    latest = LatestPrice(
        asset_id="asset-1",
        provider_id="provider-1",
        price=Decimal("150"),
        observed_at=observed_at,
    )
    rule = AlertRule(
        user_id="user-1",
        asset_id="asset-1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("100"),
        cooldown_minutes=0,
        last_triggered_at=None,
    )
    session.add_all([latest, rule])
    await session.commit()

    evaluator = AlertEvaluatorService(session)

    first_events = await evaluator.evaluate_asset("asset-1")
    second_events = await evaluator.evaluate_asset("asset-1")

    assert len(first_events) == 1
    assert len(second_events) == 0
