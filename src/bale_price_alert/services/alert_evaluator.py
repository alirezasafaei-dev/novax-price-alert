from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Iterable

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
        """
        Evaluate all active alert rules for an asset against its latest price.
        Returns created AlertEvents.
        """

        latest_price = await self._get_latest_price(asset_id)
        if latest_price is None:
            return []

        rules = await self._get_active_rules(asset_id)

        created_events: list[AlertEvent] = []

        for rule in rules:
            if not self._cooldown_passed(rule):
                continue

            if self._condition_matches(
                rule.condition_type,
                latest_price.price,
                rule.target_price,
            ):
                event = self._create_event(rule, latest_price.price)
                self.session.add(event)

                rule.last_triggered_at = datetime.now(UTC)

                created_events.append(event)

        if created_events:
            await self.session.commit()

        return created_events

    async def _get_latest_price(self, asset_id: str) -> LatestPrice | None:
        stmt = select(LatestPrice).where(LatestPrice.asset_id == asset_id)

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_active_rules(self, asset_id: str) -> Iterable[AlertRule]:
        stmt = select(AlertRule).where(
            AlertRule.asset_id == asset_id,
            AlertRule.is_active.is_(True),
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    def _cooldown_passed(self, rule: AlertRule) -> bool:
        if rule.last_triggered_at is None:
            return True

        next_allowed = rule.last_triggered_at + timedelta(
            minutes=rule.cooldown_minutes
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

    def _create_event(
        self,
        rule: AlertRule,
        triggered_price: Decimal,
    ) -> AlertEvent:

        return AlertEvent(
            alert_rule_id=rule.id,
            triggered_price=triggered_price,
            triggered_at=datetime.now(UTC),
            status=AlertEventStatus.PENDING,
        )
