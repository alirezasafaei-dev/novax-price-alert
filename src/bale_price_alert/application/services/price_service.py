from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.domain.price_snapshot import PriceSnapshot
from bale_price_alert.infra.providers.base import PricePoint


class PriceService:
    """
    Handles persistence of incoming prices.

    Responsibilities:
    - store historical snapshot
    - update latest price cache
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session: AsyncSession = session

    async def save_price(
        self,
        asset_id: str,
        provider_id: str,
        price_point: PricePoint,
    ) -> None:
        """
        Persist price snapshot and update latest price.
        """

        observed_at: datetime = price_point.observed_at

        # ---- 1️⃣ ذخیره snapshot تاریخی ----
        snapshot = PriceSnapshot(
            asset_id=asset_id,
            provider_id=provider_id,
            price=price_point.price,
            observed_at=observed_at,
            raw_data=price_point.raw_data,
        )
        self.session.add(snapshot)

        # ---- 2️⃣ آپدیت یا ساخت رکورد latest_price ----
        result = await self.session.execute(
            select(LatestPrice).where(LatestPrice.asset_id == asset_id)
        )
        latest: LatestPrice | None = result.scalar_one_or_none()

        if latest is None:
            latest = LatestPrice(
                asset_id=asset_id,
                provider_id=provider_id,
                price=price_point.price,
                observed_at=observed_at,
            )
            self.session.add(latest)
        else:
            latest.price = price_point.price
            latest.provider_id = provider_id
            latest.observed_at = observed_at

        # ---- 3️⃣ نهایی‌سازی ----
        await self.session.commit()
