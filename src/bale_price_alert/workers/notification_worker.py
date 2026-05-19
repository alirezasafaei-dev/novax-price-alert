import asyncio
import logging

from bale_price_alert.workers.jobs.notification_dispatch_job import (
    run_notification_dispatch_job,
)

logger = logging.getLogger(__name__)

NOTIFICATION_INTERVAL_SECONDS = 3


async def notification_loop() -> None:
    while True:
        try:
            await run_notification_dispatch_job()
        except Exception:
            logger.exception("notification dispatch job failed")

        await asyncio.sleep(NOTIFICATION_INTERVAL_SECONDS)
