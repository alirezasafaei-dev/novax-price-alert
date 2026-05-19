from collections.abc import Mapping

from bale_price_alert.infra.providers.base import BasePriceProvider
from bale_price_alert.infra.providers.mock import MockPriceProvider


class ProviderRegistry:
    def __init__(self) -> None:
        providers = [MockPriceProvider()]
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
