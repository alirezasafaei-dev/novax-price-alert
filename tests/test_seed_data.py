import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.provider import Provider
from novax_price_alert.services.seed_data import seed_mvp_data


@pytest.mark.anyio
async def test_seed_mvp_data_creates_iran_market_assets(db_session: AsyncSession) -> None:
    await seed_mvp_data(db_session)

    assets = (await db_session.execute(select(Asset).order_by(Asset.priority))).scalars().all()
    providers = (await db_session.execute(select(Provider))).scalars().all()

    symbols = [asset.symbol for asset in assets]
    # Core Iranian market assets must be present (full product, not limited MVP seed)
    for core in ["USD_IRT", "EUR_IRT", "GOLD_18K_IRT", "SEKKEH_EMAMI_IRT", "USDT_IRT"]:
        assert core in symbols, f"missing core asset {core}"
    # Crypto etc may be added for production richness
    assert len(symbols) >= 5
    assert {provider.slug for provider in providers} == {
        "nerkh",
        "tgju_scrape",
        "alanchand",
        "api_ir",
        "bonbast",
    }
