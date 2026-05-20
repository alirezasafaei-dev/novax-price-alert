from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.domain.alert_rule import AlertRule
from bale_price_alert.domain.enums import AlertCondition, AlertEventStatus
from bale_price_alert.domain.latest_price import LatestPrice


class AlertEvaluatorService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def evaluate_asset(self, asset_id: str) -> List[AlertEvent]:
        latest_stmt = select(LatestPrice).where(LatestPrice.asset_id == asset_id)
        latest_res = await self.session.execute(latest_stmt)
        latest = latest_res.scalar_one_or_none()

        if latest is None:
            return []

        rules_stmt = select(AlertRule).where(
            AlertRule.asset_id == asset_id,
            AlertRule.is_active.is_(True),
        )

        rules_res = await self.session.execute(rules_stmt)
        rules = rules_res.scalars().all()

        events: List[AlertEvent] = []

        now = datetime.now(UTC)

        for rule in rules:
            if not self._condition_match(rule, latest.price):
                continue

            if self._cooldown_active(rule, now):
                continue

            if rule.last_triggered_at == latest.observed_at:
                continue

            event = AlertEvent(
                alert_rule_id=rule.id,
                triggered_price=latest.price,
                triggered_at=latest.observed_at,
                status=AlertEventStatus.PENDING,
            )

            self.session.add(event)

            rule.last_triggered_at = latest.observed_at

            events.append(event)

        await self.session.commit()

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
