from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.application.services.price_service import PriceService
from bale_price_alert.domain.asset import Asset
from bale_price_alert.domain.provider import Provider
from bale_price_alert.infra.providers.base import BasePriceProvider


class PriceIngestionService:
    def __init__(
        self,
        session: AsyncSession,
        provider: BasePriceProvider,
    ) -> None:
        self.session = session
        self.provider = provider
        self.price_service = PriceService(session)

    async def ingest_all_assets(self) -> int:
        provider_record = await self._get_provider_by_slug(self.provider.slug)

        stmt = select(Asset)
        result = await self.session.execute(stmt)
        assets = result.scalars().all()

        count = 0
        for asset in assets:
            price_point = await self.provider.get_price(asset.symbol)
            await self.price_service.save_price(
                asset_id=asset.id,
                provider_id=provider_record.id,
                price_point=price_point,
            )
            count += 1

        return count

    async def _get_provider_by_slug(self, slug: str) -> Provider:
        stmt = select(Provider).where(Provider.slug == slug)
        result = await self.session.execute(stmt)
        provider = result.scalar_one_or_none()

        if provider is None:
            msg = f"Provider record not found for slug={slug}"
            raise LookupError(msg)

        return provider
