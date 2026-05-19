from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.domain.alert_rule import AlertRule
from bale_price_alert.domain.enums import AlertCondition, AlertEventStatus
from bale_price_alert.domain.latest_price import LatestPrice


class AlertEvaluatorService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def evaluate_asset(self, asset_id: str) -> list[AlertEvent]:
        latest_price = await self._get_latest_price(asset_id)
        if latest_price is None:
            return []

        rules = await self._get_active_rules(asset_id)
        created_events: list[AlertEvent] = []

        for rule in rules:
            if not self._cooldown_passed(rule):
                continue

            if not self._condition_matches(
                rule.condition_type,
                latest_price.price,
                rule.target_price,
            ):
                continue

            if await self._already_triggered_for_timestamp(rule.id, latest_price.observed_at):
                continue

            event = self._create_event(
                rule=rule,
                triggered_price=latest_price.price,
                triggered_at=latest_price.observed_at,
            )
            self.session.add(event)
            rule.last_triggered_at = latest_price.observed_at
            created_events.append(event)

        if created_events:
            await self.session.commit()

        return created_events

    async def _get_latest_price(self, asset_id: str) -> LatestPrice | None:
        stmt = select(LatestPrice).where(LatestPrice.asset_id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_active_rules(self, asset_id: str) -> list[AlertRule]:
        stmt = select(AlertRule).where(
            AlertRule.asset_id == asset_id,
            AlertRule.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    def _cooldown_passed(self, rule: AlertRule) -> bool:
        if rule.last_triggered_at is None:
            return True

        next_allowed = rule.last_triggered_at + timedelta(
            minutes=rule.cooldown_minutes,
        )
        return datetime.now(UTC) >= next_allowed

    def _condition_matches(
        self,
        condition: AlertCondition,
        current_price: Decimal,
        target_price: Decimal,
    ) -> bool:
        if condition == AlertCondition.ABOVE:
            return current_price > target_price
        if condition == AlertCondition.BELOW:
            return current_price < target_price
        return False

    async def _already_triggered_for_timestamp(
        self,
        alert_rule_id: str,
        triggered_at: datetime,
    ) -> bool:
        stmt = select(AlertEvent.id).where(
            AlertEvent.alert_rule_id == alert_rule_id,
            AlertEvent.triggered_at == triggered_at,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _create_event(
        self,
        rule: AlertRule,
        triggered_price: Decimal,
        triggered_at: datetime,
    ) -> AlertEvent:
        return AlertEvent(
            alert_rule_id=rule.id,
            triggered_price=triggered_price,
            triggered_at=triggered_at,
            status=AlertEventStatus.PENDING,
        )
