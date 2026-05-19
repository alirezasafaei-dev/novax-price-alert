import asyncio
import logging

from bale_price_alert.workers.scheduler import WorkerScheduler

logger = logging.getLogger(__name__)


class WorkerRunner:
    def __init__(self) -> None:
        self.scheduler = WorkerScheduler()

    async def start(self) -> None:
        logger.info("Starting worker runner")
        await self.scheduler.start()

    async def shutdown(self) -> None:
        logger.info("Stopping worker runner")
        await self.scheduler.stop()


async def run_worker() -> None:
    runner = WorkerRunner()

    try:
        await runner.start()
    except asyncio.CancelledError:
        await runner.shutdown()
