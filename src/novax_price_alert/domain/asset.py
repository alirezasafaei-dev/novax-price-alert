from typing import Any

from sqlalchemy import Boolean, Integer, String, event
from sqlalchemy.orm import Mapped, mapped_column

from novax_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Asset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "assets"

    symbol: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=False,
    )

    canonical_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="currency")
    unit: Mapped[str] = mapped_column(String(16), nullable=False, default="IRT")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


@event.listens_for(Asset, "init", propagate=True)
def _set_default_canonical_id(
    target: "Asset",
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> None:
    cid = kwargs.get("canonical_id")
    if not cid and "symbol" in kwargs:
        kwargs["canonical_id"] = kwargs["symbol"]
