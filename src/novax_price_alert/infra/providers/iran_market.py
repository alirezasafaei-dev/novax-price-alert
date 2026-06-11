from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import httpx

from novax_price_alert.infra.providers.base import BasePriceProvider, PricePoint

PROVIDER_SYMBOLS: dict[str, dict[str, str]] = {
    "USD_IRT": {
        "category": "currency",
        "alanchand": "USD",
        "api_ir": "USD",
        "bonbast": "usd",
        "nerkh": "USD",
    },
    "EUR_IRT": {
        "category": "currency",
        "alanchand": "EUR",
        "api_ir": "EUR",
        "nerkh": "EUR",
    },
    "GOLD_18K_IRT": {
        "category": "gold",
        "alanchand": "GOLD18",
        "api_ir": "GOLD18",
        "nerkh": "GOLD18K",
    },
    "SEKKEH_EMAMI_IRT": {
        "category": "gold",
        "alanchand": "EMAMI",
        "api_ir": "EMAMI",
        "nerkh": "SEKE_EMAMI",
    },
    "USDT_IRT": {"category": "crypto", "alanchand": "USDT", "api_ir": "USDT", "nerkh": "USDT"},
}


class AlanChandProvider(BasePriceProvider):
    def __init__(self, *, api_token: str, base_url: str) -> None:
        self.api_token = api_token
        self.base_url = base_url.rstrip("/")

    @property
    def slug(self) -> str:
        return "alanchand"

    async def get_price(self, symbol: str) -> PricePoint:
        return (await self.get_prices([symbol]))[symbol]

    async def get_prices(self, symbols: list[str]) -> dict[str, PricePoint]:
        if not self.api_token:
            raise RuntimeError("AlanChand API token is not configured")

        by_category: dict[str, list[str]] = {}
        for symbol in symbols:
            category = PROVIDER_SYMBOLS.get(symbol, {}).get("category", "currency")
            by_category.setdefault(category, []).append(symbol)

        results: dict[str, PricePoint] = {}
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            for category, grouped_symbols in by_category.items():
                provider_symbols = [
                    PROVIDER_SYMBOLS.get(symbol, {}).get("alanchand", symbol)
                    for symbol in grouped_symbols
                ]
                response = await client.get(
                    self.base_url,
                    params={"type": category, "symbols": ",".join(provider_symbols)},
                    headers={"Authorization": f"Bearer {self.api_token}"},
                )
                response.raise_for_status()
                payload = response.json()
                for symbol in grouped_symbols:
                    raw = _extract_raw_price(
                        payload,
                        PROVIDER_SYMBOLS.get(symbol, {}).get("alanchand", symbol),
                    )
                    results[symbol] = _to_price_point(
                        symbol=symbol,
                        raw=raw,
                        provider_slug=self.slug,
                        source_quality="primary",
                    )
        return results


class NerkhProvider(BasePriceProvider):
    def __init__(self, *, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    @property
    def slug(self) -> str:
        return "nerkh"

    async def get_price(self, symbol: str) -> PricePoint:
        if not self.api_key:
            raise RuntimeError("Nerkh API key is not configured")
        provider_symbol = PROVIDER_SYMBOLS.get(symbol, {}).get("nerkh", symbol)
        category = PROVIDER_SYMBOLS.get(symbol, {}).get("category", "currency")
        nerkh_category = "gold" if category == "coin" else category
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            response = await client.get(
                f"{self.base_url}/v1/prices/json/{nerkh_category}/{provider_symbol}",
                params={"x-api-key": self.api_key},
            )
            response.raise_for_status()
        return _to_price_point(
            symbol=symbol,
            raw=_extract_raw_price(response.json(), provider_symbol),
            provider_slug=self.slug,
            source_quality="free",
        )


class TgjuScrapeProvider(BasePriceProvider):
    paths: dict[str, str] = {
        "USD_IRT": "/profile/price_dollar_rl",
        "EUR_IRT": "/profile/price_eur",
        "GOLD_18K_IRT": "/profile/geram18",
        "SEKKEH_EMAMI_IRT": "/profile/sekee",
        "USDT_IRT": "/",
    }

    def __init__(self, *, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    @property
    def slug(self) -> str:
        return "tgju_scrape"

    async def get_price(self, symbol: str) -> PricePoint:
        path = self.paths.get(symbol)
        if path is None:
            raise RuntimeError(f"TGJU scraping is not configured for {symbol}")
        async with httpx.AsyncClient(
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
            trust_env=False,
        ) as client:
            response = await client.get(f"{self.base_url}{path}")
            response.raise_for_status()
        html = response.text
        price = _extract_tgju_price(symbol, html)
        now = datetime.now(timezone.utc)
        return PricePoint(
            symbol=symbol,
            price=price,
            observed_at=now,
            fetched_at=now,
            provider_slug=self.slug,
            unit="IRT",
            source_quality="free_scrape",
            raw_data={"source": "tgju", "path": path},
        )

    async def get_prices(self, symbols: list[str]) -> dict[str, PricePoint]:
        prices: dict[str, PricePoint] = {}
        last_error: Exception | None = None

        for symbol in symbols:
            try:
                prices[symbol] = await self.get_price(symbol)
            except Exception as exc:
                last_error = exc

        if prices:
            return prices

        if last_error is not None:
            raise last_error

        return prices


class ApiIrProvider(BasePriceProvider):
    def __init__(self, *, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    @property
    def slug(self) -> str:
        return "api_ir"

    async def get_price(self, symbol: str) -> PricePoint:
        if not self.api_key or not self.base_url:
            raise RuntimeError("API.ir configuration is incomplete")
        provider_symbol = PROVIDER_SYMBOLS.get(symbol, {}).get("api_ir", symbol)
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            response = await client.get(
                self.base_url,
                params={"symbol": provider_symbol},
                headers={"X-API-Key": self.api_key},
            )
            response.raise_for_status()
        return _to_price_point(
            symbol=symbol,
            raw=_extract_raw_price(response.json(), provider_symbol),
            provider_slug=self.slug,
            source_quality="backup",
        )


class BonbastProvider(BasePriceProvider):
    def __init__(self, *, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    @property
    def slug(self) -> str:
        return "bonbast"

    async def get_price(self, symbol: str) -> PricePoint:
        if symbol != "USD_IRT":
            raise RuntimeError("Bonbast failover is only enabled for supported FX symbols")
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            response = await client.get(self.base_url)
            response.raise_for_status()
        raw = _extract_raw_price(response.json(), "usd")
        return _to_price_point(
            symbol=symbol,
            raw=raw,
            provider_slug=self.slug,
            source_quality="failover",
        )


def _to_price_point(
    *,
    symbol: str,
    raw: dict[str, Any],
    provider_slug: str,
    source_quality: str,
) -> PricePoint:
    now = datetime.now(timezone.utc)
    price = raw.get("price") or raw.get("value") or raw.get("last") or raw.get("sell")
    if price is None:
        raise RuntimeError(f"provider response does not contain price for {symbol}")
    observed_at = raw.get("observed_at") or raw.get("updated_at") or raw.get("time")
    return PricePoint(
        symbol=symbol,
        price=Decimal(str(price).replace(",", "")),
        observed_at=_parse_observed_at(observed_at) or now,
        fetched_at=now,
        provider_slug=provider_slug,
        unit="IRT",
        source_quality=source_quality,
        raw_data=raw,
    )


def _extract_raw_price(payload: Any, provider_symbol: str) -> dict[str, Any]:
    if isinstance(payload, dict):
        for key in (provider_symbol, provider_symbol.lower(), provider_symbol.upper()):
            value = payload.get(key)
            if isinstance(value, dict):
                return value
        data = payload.get("data")
        if isinstance(data, dict):
            return _extract_raw_price(data, provider_symbol)
        if isinstance(data, list):
            payload = data
        elif any(key in payload for key in ("price", "value", "last", "sell")):
            return payload
    if isinstance(payload, list):
        for item in payload:
            if not isinstance(item, dict):
                continue
            item_symbol = str(item.get("symbol") or item.get("name") or item.get("code") or "")
            if item_symbol.lower() == provider_symbol.lower():
                return item
    raise RuntimeError(f"provider response does not contain symbol {provider_symbol}")


def _parse_observed_at(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, int | float):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _extract_tgju_price(symbol: str, html: str) -> Decimal:
    if symbol == "USDT_IRT":
        pattern = (
            r'id="l-crypto-tether-irr"[\s\S]*?'
            r'<span class="info-price">(?P<price>[0-9,]+(?:\.[0-9]+)?)</span>'
        )
    else:
        pattern = (
            r'<span class="price" data-col="info\.last_trade\.PDrCotVal">'
            r"(?P<price>[0-9,]+(?:\.[0-9]+)?)</span>"
        )
    match = re.search(pattern, html)
    if match is None:
        raise RuntimeError(f"TGJU page did not contain a parseable price for {symbol}")
    return Decimal(match.group("price").replace(",", ""))
