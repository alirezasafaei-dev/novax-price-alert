from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    bale_user_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )

    username: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
