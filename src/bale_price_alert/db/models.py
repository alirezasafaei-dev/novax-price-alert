import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from bale_price_alert.domain.alert import Alert
from bale_price_alert.domain.asset import Asset
from bale_price_alert.domain.user import User

__all__ = [
    "User",
    "Asset",
    "Alert",
]


class HealthCheckLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "health_check_log"

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ok")

    @staticmethod
    def new() -> "HealthCheckLog":
        return HealthCheckLog(id=str(uuid.uuid4()))
