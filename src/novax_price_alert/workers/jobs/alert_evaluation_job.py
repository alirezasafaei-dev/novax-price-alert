import logging
import uuid

from sqlalchemy import select

from novax_price_alert.core.observability import emit_event, record_metric
from novax_price_alert.core.settings import settings
from novax_price_alert.db.session import AsyncSessionLocal
from novax_price_alert.domain.asset import Asset
from novax_price_alert.infra.cache import PriceCache
from novax_price_alert.services.alert_evaluator import AlertEvaluatorService

logger = logging.getLogger(__name__)


async def run_alert_evaluation_job() -> None:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Asset)
            result = await session.execute(stmt)
            assets = result.scalars().all()

            cache = (
                PriceCache(settings.redis_url or "", ttl_seconds=60) if settings.redis_url else None
            )
            evaluator = AlertEvaluatorService(session, cache=cache)
            total_events = 0
            worker_run_id = str(uuid.uuid4())

            for asset in assets:
                events = await evaluator.evaluate_asset(asset.id, worker_run_id=worker_run_id)
                total_events += len(events)

        logger.info(
            "alert evaluation job completed",
            extra={"triggered_events": total_events, "worker_run_id": worker_run_id},
        )
    except Exception as exc:
        record_metric("worker_failure_rate")
        emit_event("worker_failure", job="alert_evaluation", error=str(exc))
        logger.exception("alert evaluation job failed")
