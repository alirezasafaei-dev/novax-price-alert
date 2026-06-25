import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from novax_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from novax_price_alert.domain.admin_audit import AdminAuditLog
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.price_snapshot import PriceSnapshot
from novax_price_alert.domain.provider import Provider
from novax_price_alert.domain.user import User

__all__ = [
    "User",
    "Asset",
    "AlertRule",
    "AlertEvent",
    "Provider",
    "PriceSnapshot",
    "LatestPrice",
    "AdminAuditLog",
]


class HealthCheckLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "health_check_log"

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ok")

    @staticmethod
    def new() -> "HealthCheckLog":
        return HealthCheckLog(id=str(uuid.uuid4()))
