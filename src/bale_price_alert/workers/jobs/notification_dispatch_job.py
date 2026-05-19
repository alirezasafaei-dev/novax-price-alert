import logging

from bale_price_alert.db.session import AsyncSessionLocal
from bale_price_alert.infra.notifications.mock import MockNotificationSender
from bale_price_alert.services.notification_dispatcher import (
    NotificationDispatcherService,
)

logger = logging.getLogger(__name__)


async def run_notification_dispatch_job() -> None:
    async with AsyncSessionLocal() as session:
        sender = MockNotificationSender()
        service = NotificationDispatcherService(session=session, sender=sender)
        sent_count = await service.dispatch_pending_events()

    logger.info(
        "notification dispatch job completed",
        extra={"sent_count": sent_count},
    )
