import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from bale_price_alert.domain.alert_event import AlertEvent
from bale_price_alert.domain.alert_rule import AlertRule
from bale_price_alert.domain.asset import Asset
from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.domain.price_snapshot import PriceSnapshot
from bale_price_alert.domain.provider import Provider
from bale_price_alert.domain.user import User

__all__ = [
    "User",
    "Asset",
    "AlertRule",
    "AlertEvent",
    "Provider",
    "PriceSnapshot",
    "LatestPrice",
]

class HealthCheckLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "health_check_log"

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ok")

    @staticmethod
    def new() -> "HealthCheckLog":
        return HealthCheckLog(id=str(uuid.uuid4()))
