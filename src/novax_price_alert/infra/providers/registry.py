from collections.abc import Mapping

from novax_price_alert.core.settings import settings
from novax_price_alert.infra.providers.base import BasePriceProvider
from novax_price_alert.infra.providers.iran_market import (
    AlanChandProvider,
    ApiIrProvider,
    BonbastProvider,
    NerkhProvider,
    TgjuScrapeProvider,
)
from novax_price_alert.infra.providers.mock import MockPriceProvider


class ProviderRegistry:
    def __init__(self) -> None:
        providers: list[BasePriceProvider] = []
        if settings.use_mock_provider:
            providers.append(MockPriceProvider())
        if settings.nerkh_api_key and settings.nerkh_base_url:
            providers.append(
                NerkhProvider(api_key=settings.nerkh_api_key, base_url=settings.nerkh_base_url)
            )
        if settings.tgju_base_url:
            providers.append(TgjuScrapeProvider(base_url=settings.tgju_base_url))
        if settings.alanchand_api_token and settings.alanchand_base_url:
            providers.append(
                AlanChandProvider(
                    api_token=settings.alanchand_api_token,
                    base_url=settings.alanchand_base_url,
                )
            )
        if settings.api_ir_api_key and settings.api_ir_base_url:
            providers.append(
                ApiIrProvider(api_key=settings.api_ir_api_key, base_url=settings.api_ir_base_url)
            )
        if settings.bonbast_base_url:
            providers.append(BonbastProvider(base_url=settings.bonbast_base_url))
        self._providers: dict[str, BasePriceProvider] = {
            provider.slug: provider for provider in providers
        }

    def get(self, slug: str) -> BasePriceProvider:
        provider = self._providers.get(slug)
        if provider is None:
            msg = f"Provider not found: {slug}"
            raise LookupError(msg)
        return provider

    def all(self) -> Mapping[str, BasePriceProvider]:
        return self._providers

    def ordered(self) -> list[BasePriceProvider]:
        priority = {
            "mock": 0,
            "nerkh": 5,
            "tgju_scrape": 8,
            "alanchand": 10,
            "api_ir": 20,
            "bonbast": 30,
        }
        return sorted(self._providers.values(), key=lambda provider: priority[provider.slug])
