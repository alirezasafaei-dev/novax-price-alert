from decimal import Decimal

from bale_price_alert.domain.alert import Alert
from bale_price_alert.domain.enums import AlertCondition


def test_alert_model_fields() -> None:
    alert = Alert(
        user_id="user-1",
        asset_id="asset-1",
        condition=Alert.normalize_condition(AlertCondition.ABOVE),
        target_price=Decimal("123.45"),
        is_enabled=True,
        cooldown_seconds=3600,
        last_triggered_at=None,
    )

    assert alert.condition == "above"
    assert alert.target_price == Decimal("123.45")
    assert alert.is_enabled is True
    assert alert.cooldown_seconds == 3600
    assert alert.last_triggered_at is None
