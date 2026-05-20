from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.alert_rule import AlertRule


class AlertCRUDService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_alerts(self, user_id: int) -> Sequence[AlertRule]:
        stmt = select(AlertRule).where(AlertRule.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, alert: AlertRule) -> AlertRule:
        self.session.add(alert)
        await self.session.commit()
        await self.session.refresh(alert)
        return alert

    async def deactivate(self, alert_id: int) -> AlertRule | None:
        stmt = select(AlertRule).where(AlertRule.id == alert_id)
        result = await self.session.execute(stmt)
        alert = result.scalar_one_or_none()

        if alert is None:
            return None

        alert.is_active = False
        await self.session.commit()
        return alert
