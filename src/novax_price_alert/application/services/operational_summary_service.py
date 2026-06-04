from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.schemas.operations import LatestPriceSummaryOut, OperationalSummaryOut
from novax_price_alert.core.observability import get_metrics_snapshot
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule
from novax_price_alert.domain.latest_price import LatestPrice


class OperationalSummaryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def summary(self) -> OperationalSummaryOut:
        return OperationalSummaryOut(
            metrics=get_metrics_snapshot(),
            alerts_by_state=await self._count_by(AlertRule.lifecycle_state),
            events_by_status=await self._count_by(AlertEvent.status),
            latest_prices=await self._latest_price_summary(),
        )

    async def _count_by(self, column: Any) -> dict[str, int]:
        result = await self.session.execute(select(column, func.count()).group_by(column))
        return {str(key): int(count) for key, count in result.all()}

    async def _latest_price_summary(self) -> LatestPriceSummaryOut:
        result = await self.session.execute(
            select(
                func.count(LatestPrice.id),
                func.sum(case((LatestPrice.is_stale.is_(True), 1), else_=0)),
                func.min(LatestPrice.observed_at),
                func.max(LatestPrice.observed_at),
            )
        )
        total, stale, oldest_observed_at, newest_observed_at = result.one()
        total_count = int(total or 0)
        stale_count = int(stale or 0)
        return LatestPriceSummaryOut(
            total=total_count,
            fresh=max(total_count - stale_count, 0),
            stale=stale_count,
            oldest_observed_at=oldest_observed_at,
            newest_observed_at=newest_observed_at,
        )
