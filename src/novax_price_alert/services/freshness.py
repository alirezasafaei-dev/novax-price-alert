from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from novax_price_alert.domain.enums import PriceFreshness
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.policies import FreshnessThresholds


@dataclass(frozen=True)
class FreshnessPolicy:
    expected_update_cadence: timedelta = FreshnessThresholds.EXPECTED_UPDATE_CADENCE
    fresh_threshold: timedelta = FreshnessThresholds.FRESH
    stale_threshold: timedelta = FreshnessThresholds.STALE
    unavailable_threshold: timedelta = FreshnessThresholds.UNAVAILABLE


@dataclass(frozen=True)
class FreshnessResult:
    classification: PriceFreshness
    reason: str

    @property
    def evaluation_allowed(self) -> bool:
        return self.classification == PriceFreshness.FRESH


DEFAULT_FRESHNESS_POLICY = FreshnessPolicy()


def classify_latest_price(
    latest: LatestPrice | None,
    *,
    now: datetime | None = None,
    policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICY,
) -> FreshnessResult:
    if latest is None:
        return FreshnessResult(PriceFreshness.UNAVAILABLE, "missing_latest_price")

    current_time = now or datetime.now(timezone.utc)

    if latest.is_stale:
        return FreshnessResult(PriceFreshness.STALE, "provider_marked_stale")

    stale_after = _ensure_aware(latest.stale_after)
    observed_at = _ensure_aware(latest.observed_at)
    if observed_at is None:
        return FreshnessResult(PriceFreshness.UNAVAILABLE, "missing_observed_at")

    if stale_after is not None and current_time >= stale_after:
        return FreshnessResult(PriceFreshness.STALE, "stale_after_elapsed")

    age = current_time - observed_at
    if age >= policy.unavailable_threshold:
        return FreshnessResult(
            PriceFreshness.UNAVAILABLE,
            "observed_at_unavailable_threshold_elapsed",
        )
    if age >= policy.stale_threshold:
        return FreshnessResult(PriceFreshness.STALE, "observed_at_stale_threshold_elapsed")

    return FreshnessResult(PriceFreshness.FRESH, "within_freshness_threshold")


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value
