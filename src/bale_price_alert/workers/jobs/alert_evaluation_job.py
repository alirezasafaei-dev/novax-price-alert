import logging

from sqlalchemy import select

from bale_price_alert.db.session import AsyncSessionLocal
from bale_price_alert.domain.asset import Asset
from bale_price_alert.services.alert_evaluator import AlertEvaluatorService

logger = logging.getLogger(__name__)


async def run_alert_evaluation_job() -> None:
    async with AsyncSessionLocal() as session:
        stmt = select(Asset)
        result = await session.execute(stmt)
        assets = result.scalars().all()

        evaluator = AlertEvaluatorService(session)
        total_events = 0

        for asset in assets:
            events = await evaluator.evaluate_asset(asset.id)
            total_events += len(events)

    logger.info(
        "alert evaluation job completed",
        extra={"triggered_events": total_events},
    )
