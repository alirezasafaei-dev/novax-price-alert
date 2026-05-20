from datetime import UTC, datetime
from decimal import Decimal

import pytest

from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.domain.enums import AlertEventStatus
from bale_price_alert.infra.notifications.mock import MockNotificationSender
from bale_price_alert.services.notification_dispatcher import (
    NotificationDispatcherService,
)


@pytest.mark.anyio
async def test_dispatch_pending_events_marks_event_sent(db_session) -> None:
    session = db_session

    event = AlertEvent(
        alert_rule_id="rule-1",
        triggered_price=Decimal("100.00"),
        triggered_at=datetime.now(UTC),
        status=AlertEventStatus.PENDING,
    )

    session.add(event)
    await session.commit()

    service = NotificationDispatcherService(
        session=session,
        sender=MockNotificationSender(),
    )

    sent_count = await service.dispatch_pending_events()

    assert sent_count == 1
    assert event.status == AlertEventStatus.SENT
    assert event.sent_at is not None
