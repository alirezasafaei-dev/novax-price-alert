import asyncio
import logging

from novax_price_alert.core.settings import settings
from novax_price_alert.workers.jobs.alert_evaluation_job import (
    run_alert_evaluation_job,
)

logger = logging.getLogger(__name__)


async def alert_evaluation_loop() -> None:
    while True:
        try:
            await run_alert_evaluation_job()
        except Exception:
            logger.exception("alert evaluation job failed")

        await asyncio.sleep(settings.worker_interval_seconds)
