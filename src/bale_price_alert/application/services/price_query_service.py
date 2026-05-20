from datetime import datetime
from decimal import Decimal
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.asset import Asset
from bale_price_alert.domain.latest_price import LatestPrice


class PriceQueryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def latest_prices(
        self,
        asset_symbol: str | None,
    ) -> Sequence[Row[tuple[str, str, Decimal, str | None, datetime]]]:
        """
        Returns joined latest price data.

        Tuple structure:
        (
            asset_symbol,
            asset_name,
            price,
            provider_id,
            observed_at,
        )
        """

        stmt = select(
            Asset.symbol,
            Asset.name,
            LatestPrice.price,
            LatestPrice.provider_id,
            LatestPrice.observed_at,
        ).join(LatestPrice, LatestPrice.asset_id == Asset.id)

        if asset_symbol:
            stmt = stmt.where(Asset.symbol == asset_symbol)

        result = await self.session.execute(stmt)

        return result.all()
