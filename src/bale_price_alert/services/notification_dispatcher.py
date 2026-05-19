from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.domain.enums import AlertEventStatus
from bale_price_alert.infra.notifications.base import BaseNotificationSender


class NotificationDispatcherService:
    def __init__(
        self,
        session: AsyncSession,
        sender: BaseNotificationSender,
    ) -> None:
        self.session = session
        self.sender = sender

    async def dispatch_pending_events(self) -> int:
        stmt = select(AlertEvent).where(
            AlertEvent.status == AlertEventStatus.PENDING,
        )
        result = await self.session.execute(stmt)
        events = result.scalars().all()

        sent_count = 0

        for event in events:
            try:
                await self.sender.send(event)
                event.status = AlertEventStatus.SENT
                event.sent_at = datetime.now(UTC)
                event.error_message = None
                sent_count += 1
            except Exception as exc:
                event.status = AlertEventStatus.FAILED
                event.error_message = str(exc)

        if events:
            await self.session.commit()

        return sent_count
