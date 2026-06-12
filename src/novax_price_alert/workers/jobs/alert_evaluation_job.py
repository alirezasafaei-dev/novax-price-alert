import asyncio
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


async def _evaluate_single_asset(
    asset_id: str,
    worker_run_id: str,
) -> int:
    """Evaluate alerts for a single asset. Returns the number of triggered events."""
    try:
        async with AsyncSessionLocal() as session:
            cache = (
                PriceCache(settings.redis_url or "", ttl_seconds=60) if settings.redis_url else None
            )
            evaluator = AlertEvaluatorService(session, cache=cache)
            events = await evaluator.evaluate_asset(asset_id, worker_run_id=worker_run_id)
            return len(events)
    except Exception:
        logger.exception("failed to evaluate asset %s", asset_id)
        record_metric("worker_failure_rate")
        emit_event(
            "worker_failure",
            job="alert_evaluation",
            asset_id=asset_id,
        )
        return 0


async def run_alert_evaluation_job() -> None:
    worker_run_id = str(uuid.uuid4())
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Asset)
            result = await session.execute(stmt)
            assets = result.scalars().all()

        total_events = 0
        # Process assets concurrently in batches to avoid overwhelming the DB
        asset_ids = [a.id for a in assets]
        concurrency = settings.max_concurrent_asset_evaluations

        for i in range(0, len(asset_ids), concurrency):
            batch = asset_ids[i : i + concurrency]
            results = await asyncio.gather(
                *[_evaluate_single_asset(aid, worker_run_id) for aid in batch],
                return_exceptions=True,
            )
            for r in results:
                if isinstance(r, int):
                    total_events += r
                else:
                    logger.exception("asset evaluation raised an exception: %s", r)

        logger.info(
            "alert evaluation job completed",
            extra={
                "triggered_events": total_events,
                "worker_run_id": worker_run_id,
                "assets_evaluated": len(asset_ids),
            },
        )
    except Exception as exc:
        record_metric("worker_failure_rate")
        emit_event("worker_failure", job="alert_evaluation", error=str(exc))
        logger.exception("alert evaluation job failed")
