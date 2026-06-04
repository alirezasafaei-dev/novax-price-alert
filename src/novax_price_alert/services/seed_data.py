from __future__ import annotations

from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.provider import Provider


class AssetSeed(TypedDict):
    symbol: str
    canonical_id: str
    name: str
    display_name: str
    category: str
    unit: str
    priority: int


class ProviderSeed(TypedDict):
    slug: str
    name: str
    priority: int


MVP_ASSETS: list[AssetSeed] = [
    {
        "symbol": "USD_IRT",
        "canonical_id": "USD_IRT",
        "name": "US Dollar",
        "display_name": "دلار آزاد",
        "category": "currency",
        "unit": "IRT",
        "priority": 10,
    },
    {
        "symbol": "EUR_IRT",
        "canonical_id": "EUR_IRT",
        "name": "Euro",
        "display_name": "یورو",
        "category": "currency",
        "unit": "IRT",
        "priority": 15,
    },
    {
        "symbol": "GOLD_18K_IRT",
        "canonical_id": "GOLD_18K_IRT",
        "name": "18K Gold",
        "display_name": "طلای ۱۸ عیار",
        "category": "gold",
        "unit": "IRT",
        "priority": 20,
    },
    {
        "symbol": "SEKKEH_EMAMI_IRT",
        "canonical_id": "SEKKEH_EMAMI_IRT",
        "name": "Emami Coin",
        "display_name": "سکه امامی",
        "category": "coin",
        "unit": "IRT",
        "priority": 30,
    },
    {
        "symbol": "USDT_IRT",
        "canonical_id": "USDT_IRT",
        "name": "Tether",
        "display_name": "تتر",
        "category": "crypto",
        "unit": "IRT",
        "priority": 40,
    },
]

MVP_PROVIDERS: list[ProviderSeed] = [
    {"slug": "nerkh", "name": "Nerkh", "priority": 5},
    {"slug": "tgju_scrape", "name": "TGJU Scrape", "priority": 8},
    {"slug": "alanchand", "name": "AlanChand", "priority": 10},
    {"slug": "api_ir", "name": "API.ir", "priority": 20},
    {"slug": "bonbast", "name": "Bonbast", "priority": 30},
]


async def seed_mvp_data(session: AsyncSession) -> None:
    for provider_data in MVP_PROVIDERS:
        provider_result = await session.execute(
            select(Provider).where(Provider.slug == provider_data["slug"])
        )
        provider = provider_result.scalar_one_or_none()
        if provider is None:
            session.add(Provider(**provider_data, is_active=True))

    for asset_data in MVP_ASSETS:
        asset_result = await session.execute(
            select(Asset).where(Asset.symbol == asset_data["symbol"])
        )
        asset = asset_result.scalar_one_or_none()
        if asset is None:
            session.add(Asset(**asset_data, enabled=True))
            continue
        asset.symbol = asset_data["symbol"]
        asset.canonical_id = asset_data["canonical_id"]
        asset.name = asset_data["name"]
        asset.display_name = asset_data["display_name"]
        asset.category = asset_data["category"]
        asset.unit = asset_data["unit"]
        asset.priority = asset_data["priority"]
        asset.enabled = True

    await session.commit()
