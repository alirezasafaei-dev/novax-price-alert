import logging
from collections.abc import Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.price_service import PriceService
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.provider import Provider
from novax_price_alert.infra.providers.base import BasePriceProvider, PricePoint
from novax_price_alert.infra.providers.registry import ProviderRegistry

logger = logging.getLogger(__name__)


class PriceIngestionService:
    def __init__(
        self,
        session: AsyncSession,
        provider: BasePriceProvider | None = None,
        registry: ProviderRegistry | None = None,
    ) -> None:
        self.session = session
        self.provider = provider
        self.registry = registry or ProviderRegistry()
        self.price_service = PriceService(session)

    async def ingest_all_assets(self) -> int:
        stmt = select(Asset).where(Asset.enabled.is_(True))
        result = await self.session.execute(stmt)
        assets = result.scalars().all()

        if self.provider is not None:
            symbols = self._supported_symbols(self.provider, assets)
            prices = await self.provider.get_prices(symbols)
            provider_record = await self._ensure_provider(self.provider)
            return await self._save_prices(assets, provider_record, prices)

        for provider in self.registry.ordered():
            try:
                symbols = self._supported_symbols(provider, assets)
                if not symbols:
                    continue
                prices = await provider.get_prices(symbols)
            except Exception as exc:
                logger.warning(
                    "price provider failed",
                    extra={"provider": provider.slug, "error": str(exc)},
                )
                continue
            provider_record = await self._ensure_provider(provider)
            return await self._save_prices(assets, provider_record, prices)

        raise RuntimeError("all Iran-market price providers failed")

    def _supported_symbols(
        self,
        provider: BasePriceProvider,
        assets: Sequence[Asset],
    ) -> list[str]:
        paths = getattr(provider, "paths", None)
        if isinstance(paths, dict):
            supported = set(paths.keys())
            return [asset.symbol for asset in assets if asset.symbol in supported]
        return [asset.symbol for asset in assets]

    async def _save_prices(
        self,
        assets: Sequence[Asset],
        provider_record: Provider,
        prices: Mapping[str, PricePoint],
    ) -> int:
        count = 0
        for asset in assets:
            price_point = prices.get(asset.symbol)
            if price_point is None:
                continue
            await self.price_service.save_price(
                asset_id=asset.id,
                provider_id=provider_record.id,
                price_point=price_point,
            )
            count += 1
        return count

    async def _ensure_provider(self, provider: BasePriceProvider) -> Provider:
        stmt = select(Provider).where(Provider.slug == provider.slug)
        result = await self.session.execute(stmt)
        provider_record = result.scalar_one_or_none()

        if provider_record is None:
            provider_record = Provider(
                slug=provider.slug,
                name=provider.slug.replace("_", ".").title(),
                priority={
                    "mock": 0,
                    "nerkh": 5,
                    "tgju_scrape": 8,
                    "alanchand": 10,
                    "api_ir": 20,
                    "bonbast": 30,
                }.get(
                    provider.slug,
                    100,
                ),
                is_active=True,
            )
            self.session.add(provider_record)
            await self.session.commit()
            await self.session.refresh(provider_record)

        return provider_record
