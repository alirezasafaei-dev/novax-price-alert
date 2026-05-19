import logging

from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.infra.notifications.base import BaseNotificationSender

logger = logging.getLogger(__name__)


class MockNotificationSender(BaseNotificationSender):
    async def send(self, event: AlertEvent) -> None:
        logger.info(
            "mock notification sent",
            extra={
                "alert_event_id": event.id,
                "triggered_price": str(event.triggered_price),
            },
        )
