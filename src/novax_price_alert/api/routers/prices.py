from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.schemas.price import LatestPriceItemOut, LatestPricesOut
from novax_price_alert.application.services.price_query_service import PriceQueryService

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/latest", response_model=LatestPricesOut)
async def get_latest_prices(
    asset_code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> LatestPricesOut:
    service = PriceQueryService(db)

    rows = await service.latest_prices(asset_code)

    items = [
        LatestPriceItemOut(
            asset_code=row.symbol,
            asset_name=row.name,
            price_value=row.price,
            currency_code=row.display_unit,
            display_unit=row.display_unit,
            provider=row.provider_slug,
            fetched_at=row.observed_at,
            is_stale=row.is_stale,
        )
        for row in rows
    ]

    return LatestPricesOut(items=items)
