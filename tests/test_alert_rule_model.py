from decimal import Decimal

from bale_price_alert.domain.alert_rule import AlertRule
from bale_price_alert.domain.enums import AlertCondition


def test_alert_rule_fields() -> None:
    rule = AlertRule(
        user_id="user-1",
        asset_id="asset-1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("123.45"),
        is_active=True,
        cooldown_minutes=30,
        last_triggered_at=None,
    )

    assert rule.condition_type == AlertCondition.ABOVE
    assert rule.target_price == Decimal("123.45")
    assert rule.is_active is True
