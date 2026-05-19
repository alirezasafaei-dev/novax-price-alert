import asyncio
import logging

from bale_price_alert.workers.jobs.price_fetch_job import run_price_fetch_job

logger = logging.getLogger(__name__)

FETCH_INTERVAL_SECONDS = 10


async def price_fetch_loop() -> None:
    while True:
        try:
            await run_price_fetch_job()
        except Exception:
            logger.exception("price fetch job failed")

        await asyncio.sleep(FETCH_INTERVAL_SECONDS)
