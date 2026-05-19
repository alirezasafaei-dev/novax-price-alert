import asyncio
import logging

from bale_price_alert.workers.jobs.alert_evaluation_job import (
    run_alert_evaluation_job,
)

logger = logging.getLogger(__name__)

EVALUATION_INTERVAL_SECONDS = 5


async def alert_evaluation_loop() -> None:
    while True:
        try:
            await run_alert_evaluation_job()
        except Exception:
            logger.exception("alert evaluation job failed")

        await asyncio.sleep(EVALUATION_INTERVAL_SECONDS)
