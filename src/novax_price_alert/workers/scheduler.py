import asyncio
import logging

from novax_price_alert.workers.alert_worker import alert_evaluation_loop
from novax_price_alert.workers.notification_worker import notification_loop
from novax_price_alert.workers.price_fetch_worker import price_fetch_loop

logger = logging.getLogger(__name__)


class WorkerScheduler:
    def __init__(self) -> None:
        self.tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        logger.info("Starting worker scheduler")

        self.tasks.append(asyncio.create_task(price_fetch_loop()))
        self.tasks.append(asyncio.create_task(alert_evaluation_loop()))
        self.tasks.append(asyncio.create_task(notification_loop()))

        await asyncio.gather(*self.tasks)

    async def stop(self) -> None:
        logger.info("Stopping worker scheduler")

        for task in self.tasks:
            task.cancel()

        await asyncio.gather(*self.tasks, return_exceptions=True)
