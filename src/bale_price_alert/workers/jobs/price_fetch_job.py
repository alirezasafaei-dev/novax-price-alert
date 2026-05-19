import logging

from bale_price_alert.db.session import AsyncSessionLocal
from bale_price_alert.infra.providers.registry import ProviderRegistry
from bale_price_alert.services.price_ingestion import PriceIngestionService

logger = logging.getLogger(__name__)


async def run_price_fetch_job() -> None:
    registry = ProviderRegistry()
    provider = registry.get("mock")

    async with AsyncSessionLocal() as session:
        service = PriceIngestionService(session=session, provider=provider)
        ingested_count = await service.ingest_all_assets()

    logger.info(
        "price fetch job completed",
        extra={"ingested_count": ingested_count, "provider": provider.slug},
    )
