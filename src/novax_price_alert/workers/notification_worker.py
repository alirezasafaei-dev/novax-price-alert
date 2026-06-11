import asyncio
import logging

from novax_price_alert.core.settings import settings
from novax_price_alert.workers.jobs.notification_dispatch_job import (
    run_notification_dispatch_job,
)

logger = logging.getLogger(__name__)


async def notification_loop() -> None:
    while True:
        try:
            await run_notification_dispatch_job()
        except Exception:
            logger.exception("notification dispatch job failed")

        await asyncio.sleep(settings.notification_interval_seconds)
