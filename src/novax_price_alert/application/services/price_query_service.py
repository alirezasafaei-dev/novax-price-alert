from datetime import datetime
from decimal import Decimal
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.price_snapshot import PriceSnapshot
from novax_price_alert.domain.provider import Provider


class PriceQueryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def latest_prices(
        self,
        asset_symbol: str | None,
    ) -> Sequence[Row[tuple[str, str, Decimal, str, str, datetime, bool]]]:
        """
        Returns joined latest price data.

        Tuple structure:
        (
            asset_symbol,
            asset_name,
            price,
            display_unit,
            provider_slug,
            observed_at,
        )
        """

        stmt = select(
            Asset.symbol.label("symbol"),
            Asset.name.label("name"),
            LatestPrice.price.label("price"),
            Asset.unit.label("display_unit"),
            Provider.slug.label("provider_slug"),
            LatestPrice.observed_at.label("observed_at"),
            LatestPrice.is_stale.label("is_stale"),
        ).join(LatestPrice, LatestPrice.asset_id == Asset.id).outerjoin(
            Provider,
            Provider.id == LatestPrice.provider_id,
        )

        if asset_symbol:
            stmt = stmt.where(Asset.symbol == asset_symbol)

        result = await self.session.execute(stmt)

        return result.all()

    async def price_history(
        self,
        asset_symbol: str,
        limit: int,
        since: datetime | None = None,
    ) -> Sequence[Row[tuple[str, str, Decimal, str, str, datetime]]]:
        """Return recent persisted price snapshots for one asset, newest first.
        Optionally filter by observed_at >= since for range-based efficiency (e.g. for charts).
        """

        stmt = (
            select(
                Asset.symbol.label("symbol"),
                Asset.name.label("name"),
                PriceSnapshot.price.label("price"),
                Asset.unit.label("display_unit"),
                Provider.slug.label("provider_slug"),
                PriceSnapshot.observed_at.label("observed_at"),
            )
            .join(PriceSnapshot, PriceSnapshot.asset_id == Asset.id)
            .outerjoin(Provider, Provider.id == PriceSnapshot.provider_id)
            .where(Asset.symbol == asset_symbol)
        )
        if since is not None:
            stmt = stmt.where(PriceSnapshot.observed_at >= since)
        stmt = stmt.order_by(PriceSnapshot.observed_at.desc(), PriceSnapshot.created_at.desc()).limit(limit)

        result = await self.session.execute(stmt)

        return result.all()
