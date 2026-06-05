from datetime import datetime
from decimal import Decimal
from statistics import stdev
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
        stmt = stmt.order_by(
            PriceSnapshot.observed_at.desc(), PriceSnapshot.created_at.desc()
        ).limit(limit)

        result = await self.session.execute(stmt)

        return result.all()

    async def suggestions(
        self,
        watched_codes: list[str] | None = None,
        limit: int = 5,
    ) -> list[dict]:
        """Smart suggestions: unwatched assets + % change from recent PriceSnapshots
        (volatility / market move signals). Fulfills report 'smart suggestions' for UX.
        """
        watched = set(watched_codes or [])
        latest_rows = await self.latest_prices(None)
        candidates = [r for r in latest_rows if getattr(r, "symbol", None) not in watched]

        if not candidates:
            return []

        results = []
        for row in candidates[: limit * 3]:
            sym = getattr(row, "symbol", None)
            if not sym:
                continue
            snap_stmt = (
                select(PriceSnapshot.price.label("p"))
                .join(Asset, Asset.id == PriceSnapshot.asset_id)
                .where(Asset.symbol == sym)
                .order_by(PriceSnapshot.observed_at.desc())
                .limit(7)
            )
            snaps = (await self.session.execute(snap_stmt)).all()
            prices = [float(s.p) for s in snaps]
            ch = None
            vol = None
            if len(prices) >= 2 and prices[1] != 0:
                ch = round((prices[0] - prices[1]) / prices[1] * 100, 2)
            if len(prices) >= 2:
                try:
                    vol = round(stdev(prices), 2)
                except Exception:
                    vol = None
            score = abs(ch or 0) + (vol or 0) * 0.1  # simple combined score
            results.append({
                "asset_code": sym,
                "asset_name": getattr(row, "name", sym),
                "price_value": getattr(row, "price", 0),
                "display_unit": getattr(row, "display_unit", ""),
                "change_pct": ch,
                "volatility": vol,
                "reason": "high volatility/move" if score > 1 else "unwatched",
            })
            if len(results) >= limit:
                break

        results.sort(
            key=lambda x: (abs(x.get("change_pct") or 0) + (x.get("volatility") or 0) * 0.1),
            reverse=True,
        )
        return results[:limit]
