from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.latest_price import LatestPrice
from bale_price_alert.domain.price_snapshot import PriceSnapshot
from bale_price_alert.infra.providers.base import PricePoint


class PriceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_price(
        self, 
        asset_id: str, 
        provider_id: str, 
        price_point: PricePoint
    ) -> None:
        # 1. Save historical snapshot
        snapshot = PriceSnapshot(
            asset_id=asset_id,
            provider_id=provider_id,
            price=price_point.price,
            observed_at=price_point.observed_at,
            raw_data=price_point.raw_data,
        )
        self.session.add(snapshot)

        # 2. Update or Create LatestPrice
        stmt = select(LatestPrice).where(LatestPrice.asset_id == asset_id)
        result = await self.session.execute(stmt)
        latest = result.scalar_one_or_none()

        if latest:
            latest.price = price_point.price
            latest.observed_at = price_point.observed_at
            latest.provider_id = provider_id
        else:
            latest = LatestPrice(
                asset_id=asset_id,
                provider_id=provider_id,
                price=price_point.price,
                observed_at=price_point.observed_at,
            )
            self.session.add(latest)

        await self.session.commit()
