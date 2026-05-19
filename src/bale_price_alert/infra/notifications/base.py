from abc import ABC, abstractmethod

from bale_price_alert.domain.alert_event import AlertEvent


class BaseNotificationSender(ABC):
    @abstractmethod
    async def send(self, event: AlertEvent) -> None:
        """Send a notification for a triggered alert event."""
        raise NotImplementedError
