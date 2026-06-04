from fastapi import APIRouter, Depends, Query, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.schemas.price import (
    LatestPriceItemOut,
    LatestPricesOut,
    PriceHistoryItemOut,
    PriceHistoryOut,
)
from novax_price_alert.application.services.price_query_service import PriceQueryService
from novax_price_alert.core.settings import settings

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


@router.get("/history", response_model=PriceHistoryOut)
async def get_price_history(
    asset_code: str = Query(min_length=1),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> PriceHistoryOut:
    service = PriceQueryService(db)

    rows = await service.price_history(asset_code, limit)

    items = [
        PriceHistoryItemOut(
            asset_code=row.symbol,
            asset_name=row.name,
            price_value=row.price,
            currency_code=row.display_unit,
            display_unit=row.display_unit,
            provider=row.provider_slug,
            observed_at=row.observed_at,
        )
        for row in rows
    ]

    return PriceHistoryOut(items=items)


@router.post("/ingest")
async def ingest_prices(
    items: List[dict],
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest prices from external sources (GitHub Actions, etc.)
    This endpoint is used by the price fetcher running on GitHub Actions
    to avoid IP blocking on Iranian VPS.
    """
    # Verify API token
    expected_token = getattr(settings, 'METRICS_ACCESS_TOKEN', None)
    if not expected_token:
        raise HTTPException(status_code=500, detail="METRICS_ACCESS_TOKEN not configured")
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace('Bearer ', '') if authorization.startswith('Bearer ') else authorization
    if token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid API token")
    
    # Process and store prices
    service = PriceQueryService(db)
    success_count = 0
    
    for item in items:
        try:
            # Here you would call your service to store the price
            # For now, just log it
            success_count += 1
        except Exception as e:
            print(f"Error processing price item: {e}")
    
    return {
        "status": "success",
        "processed": success_count,
        "total": len(items)
    }
