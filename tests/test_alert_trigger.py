from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select

from bale_price_alert.domain.alert_rule import AlertRule
from bale_price_alert.domain.enums import AlertCondition
from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.services.alert_evaluator import AlertEvaluatorService


@pytest.mark.anyio
async def test_alert_triggers_when_price_above(db_session) -> None:
    session = db_session

    latest = LatestPrice(
        asset_id="asset1",
        provider_id="provider1",
        price=Decimal("120"),
        observed_at=datetime.now(UTC),
    )

    rule = AlertRule(
        user_id="user1",
        asset_id="asset1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("100"),
        cooldown_minutes=10,
    )

    session.add_all([latest, rule])
    await session.commit()

    evaluator = AlertEvaluatorService(session)

    events = await evaluator.evaluate_asset("asset1")

    assert len(events) == 1

    stmt = select(AlertRule)
    res = await session.execute(stmt)
    rule_db = res.scalar_one()

    assert rule_db.last_triggered_at is not None
