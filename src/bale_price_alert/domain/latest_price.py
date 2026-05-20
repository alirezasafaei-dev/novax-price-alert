from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bale_price_alert.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from bale_price_alert.domain.asset import Asset
    from bale_price_alert.domain.provider import Provider


class LatestPrice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "latest_prices"

    __table_args__ = (UniqueConstraint("asset_id", name="uq_latest_price_asset"),)

    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
    )

    provider_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("providers.id", ondelete="SET NULL"),
        nullable=True,
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
    )

    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # اصلاح تایپ relationship
    asset: Mapped["Asset"] = relationship("Asset")
    provider: Mapped["Provider | None"] = relationship("Provider")
