from datetime import datetime

from pydantic import BaseModel


class LatestPriceSummaryOut(BaseModel):
    total: int
    fresh: int
    stale: int
    oldest_observed_at: datetime | None = None
    newest_observed_at: datetime | None = None


class OperationalSummaryOut(BaseModel):
    metrics: dict[str, int]
    alerts_by_state: dict[str, int]
    events_by_status: dict[str, int]
    latest_prices: LatestPriceSummaryOut
