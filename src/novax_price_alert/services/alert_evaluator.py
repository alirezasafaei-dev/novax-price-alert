from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.core.observability import emit_event, record_metric
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule, InvalidAlertTransitionError
from novax_price_alert.domain.enums import (
    AlertCondition,
    AlertEventStatus,
    AlertLifecycleState,
    PriceFreshness,
)
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.infra.cache import PriceCache
from novax_price_alert.services.freshness import FreshnessPolicy, classify_latest_price


class AlertEvaluatorService:
    def __init__(
        self,
        session: AsyncSession,
        freshness_policy: FreshnessPolicy | None = None,
        cache: PriceCache | None = None,
    ) -> None:
        self.session = session
        self.freshness_policy = freshness_policy or FreshnessPolicy()
        self.cache = cache  # for distributed per-asset lock during eval (anti-race)

    async def evaluate_asset(
        self,
        asset_id: str,
        worker_run_id: str | None = None,
    ) -> List[AlertEvent]:
        lock_key = f"eval:lock:{asset_id}"
        lock_value = worker_run_id or "local"
        acquired = True
        if self.cache is not None:
            acquired = await self.cache.acquire_lock(lock_key, lock_value, ttl_ms=30000)
        if not acquired:
            record_metric("eval_lock_skipped")
            emit_event("eval_lock_skipped", asset_id=asset_id, worker_run_id=worker_run_id)
            return []

        try:
            latest_stmt = select(LatestPrice).where(LatestPrice.asset_id == asset_id)
            latest_res = await self.session.execute(latest_stmt)
            latest = latest_res.scalar_one_or_none()

            freshness = classify_latest_price(latest, policy=self.freshness_policy)
            if latest is None or not freshness.evaluation_allowed:
                metric_name = (
                    "price_unavailable_evaluation_count"
                    if freshness.classification == PriceFreshness.UNAVAILABLE
                    else "stale_evaluation_count"
                )
                record_metric(metric_name)
                emit_event(
                    "stale_data_detected",
                    asset_id=asset_id,
                    worker_run_id=worker_run_id,
                    freshness=freshness.classification.value,
                    reason=freshness.reason,
                )
                return []

            record_metric("alert_evaluation_count")

            rules_stmt = select(AlertRule).where(
                AlertRule.asset_id == asset_id,
                AlertRule.is_active.is_(True),
                AlertRule.lifecycle_state == AlertLifecycleState.ACTIVE,
                or_(
                    (AlertRule.condition_type == AlertCondition.ABOVE)
                    & (AlertRule.target_price <= latest.price),
                    (AlertRule.condition_type == AlertCondition.BELOW)
                    & (AlertRule.target_price >= latest.price),
                ),
            )

            rules_res = await self.session.execute(rules_stmt)
            rules = rules_res.scalars().all()

            events: List[AlertEvent] = []
            now = datetime.now(timezone.utc)

            for rule in rules:
                emit_event(
                    "alert_evaluated",
                    alert_id=rule.id,
                    user_id=rule.user_id,
                    canonical_asset_id=rule.canonical_asset_id,
                    worker_run_id=worker_run_id,
                    provider_tick_id=latest.id,
                    price=str(latest.price),
                    freshness=freshness.classification.value,
                )

                if self._cooldown_active(rule, now):
                    continue

                # Atomic claim on rule to prevent concurrent workers deciding to trigger same event
                # (strengthens T-205 per roadmap/report for eval-side idempotency)
                claim_stmt = (
                    update(AlertRule)
                    .where(
                        AlertRule.id == rule.id,
                        or_(
                            AlertRule.last_triggered_at.is_(None),
                            AlertRule.last_triggered_at < latest.observed_at,
                        ),
                    )
                    .values(
                        last_triggered_at=latest.observed_at,
                        triggered_at=latest.observed_at,
                    )
                )
                claim_res = await self.session.execute(claim_stmt)
                if getattr(claim_res, "rowcount", 0) != 1:
                    record_metric("duplicate_trigger_count")
                    emit_event(
                        "duplicate_trigger_detected",
                        alert_id=rule.id,
                        user_id=rule.user_id,
                        worker_run_id=worker_run_id,
                        reason="claim_failed_on_rule",
                    )
                    continue

                # re-fetch rule for transition (after claim)
                await self.session.refresh(rule)
                event_id = self._event_id(rule.id, latest.observed_at)
                event = AlertEvent(
                    alert_rule_id=rule.id,
                    event_id=event_id,
                    idempotency_key=f"notification:{event_id}",
                    triggered_price=latest.price,
                    triggered_at=latest.observed_at,
                    status=AlertEventStatus.PENDING,
                )

                self.session.add(event)
                try:
                    rule.transition_to(AlertLifecycleState.TRIGGERED)
                    await self.session.commit()
                except (IntegrityError, InvalidAlertTransitionError) as exc:
                    await self.session.rollback()
                    record_metric("duplicate_trigger_count")
                    emit_event(
                        "duplicate_trigger_detected",
                        alert_id=rule.id,
                        user_id=rule.user_id,
                        event_id=event_id,
                        worker_run_id=worker_run_id,
                        reason=str(type(exc).__name__),
                    )
                    continue

                await self.session.refresh(event)
                events.append(event)
                record_metric("trigger_count")
                emit_event(
                    "alert_triggered",
                    alert_id=rule.id,
                    user_id=rule.user_id,
                    event_id=event.event_id,
                    worker_run_id=worker_run_id,
                    triggered_price=str(event.triggered_price),
                    triggered_at=event.triggered_at.isoformat(),
                )

        finally:
            if self.cache is not None and acquired:
                await self.cache.release_lock(lock_key, lock_value)

        return events

    def _condition_match(self, rule: AlertRule, price: Decimal) -> bool:
        if rule.condition_type == AlertCondition.ABOVE:
            return price >= rule.target_price

        if rule.condition_type == AlertCondition.BELOW:
            return price <= rule.target_price

        return False

    def _cooldown_active(self, rule: AlertRule, now: datetime) -> bool:
        if rule.last_triggered_at is None:
            return False

        cooldown = timedelta(minutes=rule.cooldown_minutes)

        return now < rule.last_triggered_at + cooldown

    def _event_id(self, alert_rule_id: str, observed_at: datetime) -> str:
        return f"alert:{alert_rule_id}:observed:{observed_at.isoformat()}"
