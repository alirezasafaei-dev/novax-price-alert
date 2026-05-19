from datetime import UTC, datetime
from decimal import Decimal

from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.domain.enums import AlertEventStatus


def test_alert_event_fields() -> None:
    event = AlertEvent(
        alert_rule_id="rule-1",
        triggered_price=Decimal("100.00"),
        triggered_at=datetime.now(UTC),
        status=AlertEventStatus.PENDING,
        error_message=None,
        sent_at=None,
    )

    assert event.status == AlertEventStatus.PENDING
    assert event.triggered_price == Decimal("100.00")
