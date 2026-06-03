import logging
import uuid

from novax_price_alert.core.settings import settings
from novax_price_alert.db.session import AsyncSessionLocal
from novax_price_alert.infra.notifications.mock import MockNotificationSender
from novax_price_alert.infra.notifications.telegram import TelegramNotificationSender
from novax_price_alert.services.notification_dispatcher import (
    NotificationDispatcherService,
)

logger = logging.getLogger(__name__)


async def run_notification_dispatch_job() -> None:
    async with AsyncSessionLocal() as session:
        sender = (
            MockNotificationSender()
            if settings.use_mock_notifications
            else TelegramNotificationSender(
                bot_token=settings.telegram_bot_token,
                session=session,
                timeout_seconds=settings.telegram_send_timeout_seconds,
                relay_url=settings.telegram_relay_url,
                relay_secret=settings.telegram_relay_secret,
            )
        )
        worker_run_id = str(uuid.uuid4())
        service = NotificationDispatcherService(session=session, sender=sender)
        sent_count = await service.dispatch_pending_events(worker_run_id=worker_run_id)

    logger.info(
        "notification dispatch job completed",
        extra={"sent_count": sent_count, "worker_run_id": worker_run_id},
    )
