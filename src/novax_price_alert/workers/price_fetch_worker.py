import asyncio
import logging

from novax_price_alert.core.settings import settings
from novax_price_alert.workers.jobs.price_fetch_job import run_price_fetch_job

logger = logging.getLogger(__name__)


async def price_fetch_loop() -> None:
    while True:
        try:
            await run_price_fetch_job()
        except Exception:
            logger.exception("price fetch job failed")

        await asyncio.sleep(settings.worker_interval_seconds)
