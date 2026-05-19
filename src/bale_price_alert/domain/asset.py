from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Asset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "assets"

    symbol: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
