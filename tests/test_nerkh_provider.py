from decimal import Decimal

import httpx
import pytest

from novax_price_alert.infra.providers.iran_market import NerkhProvider, TgjuScrapeProvider


@pytest.mark.anyio
async def test_nerkh_provider_maps_iran_market_symbols(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_get(self: object, url: str, **kwargs: object) -> httpx.Response:
        captured["url"] = url
        captured["kwargs"] = kwargs
        return httpx.Response(
            200,
            json={"price": "123,456", "timestamp": "2026-05-31T00:00:00Z"},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    provider = NerkhProvider(api_key="free-key", base_url="https://api.nerkh.io")
    price = await provider.get_price("GOLD_18K_IRT")

    assert captured["url"] == "https://api.nerkh.io/v1/prices/json/gold/GOLD18K"
    assert captured["kwargs"] == {"params": {"x-api-key": "free-key"}}
    assert price.price == Decimal("123456")
    assert price.provider_slug == "nerkh"
    assert price.source_quality == "free"


@pytest.mark.anyio
async def test_tgju_provider_parses_profile_price(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get(self: object, url: str, **kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            text='<span class="price" data-col="info.last_trade.PDrCotVal">1,702,150</span>',
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    provider = TgjuScrapeProvider(base_url="https://www.tgju.org")
    price = await provider.get_price("USD_IRT")

    assert price.price == Decimal("1702150")
    assert price.provider_slug == "tgju_scrape"
    assert price.source_quality == "free_scrape"


@pytest.mark.anyio
async def test_tgju_provider_parses_home_usdt_irt_price(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get(self: object, url: str, **kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            text=(
                '<li id="l-crypto-tether-irr">'
                '<span class="info-value"><span class="info-price">1,700,520</span></span>'
                "</li>"
            ),
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    provider = TgjuScrapeProvider(base_url="https://www.tgju.org")
    price = await provider.get_price("USDT_IRT")

    assert price.price == Decimal("1700520")


@pytest.mark.anyio
async def test_nerkh_provider_maps_eur_symbol(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_get(self: object, url: str, **kwargs: object) -> httpx.Response:
        captured["url"] = url
        captured["kwargs"] = kwargs
        return httpx.Response(
            200,
            json={"price": "1,850,000", "timestamp": "2026-06-04T00:00:00Z"},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    provider = NerkhProvider(api_key="free-key", base_url="https://api.nerkh.io")
    price = await provider.get_price("EUR_IRT")

    assert captured["url"] == "https://api.nerkh.io/v1/prices/json/currency/EUR"
    assert captured["kwargs"] == {"params": {"x-api-key": "free-key"}}
    assert price.price == Decimal("1850000")


@pytest.mark.anyio
async def test_tgju_provider_uses_eur_profile_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake_get(self: object, url: str, **kwargs: object) -> httpx.Response:
        captured["url"] = url
        return httpx.Response(
            200,
            text='<span class="price" data-col="info.last_trade.PDrCotVal">1,850,000</span>',
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    provider = TgjuScrapeProvider(base_url="https://www.tgju.org")
    price = await provider.get_price("EUR_IRT")

    assert captured["url"] == "https://www.tgju.org/profile/price_eur"
    assert price.price == Decimal("1850000")
