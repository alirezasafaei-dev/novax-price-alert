import hmac
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.i18n import (
    AUTH_ADMIN_TOKEN_REQUIRED,
)
from novax_price_alert.api.schemas.price import (
    LatestPriceItemOut,
    LatestPricesOut,
    PriceHistoryItemOut,
    PriceHistoryOut,
    SuggestionItemOut,
    SuggestionsOut,
)
from novax_price_alert.application.services.price_query_service import PriceQueryService
from novax_price_alert.application.services.price_service import PriceService
from novax_price_alert.core.observability import emit_event, record_metric
from novax_price_alert.core.settings import settings
from novax_price_alert.db.models import Provider
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.infra.providers.base import PricePoint

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/latest", response_model=LatestPricesOut)
async def get_latest_prices(
    asset_code: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> LatestPricesOut:
    service = PriceQueryService(db)

    rows = await service.latest_prices(asset_code)

    items = []
    for row in rows:
        # Lightweight freshness for display (full policy classify available in evaluator)
        freshness = "stale" if row.is_stale else "fresh"
        items.append(
            LatestPriceItemOut(
                asset_code=row.symbol,
                asset_name=row.name,
                price_value=row.price,
                currency_code=row.display_unit,
                display_unit=row.display_unit,
                provider=row.provider_slug,
                fetched_at=row.observed_at,
                is_stale=row.is_stale,
                freshness=freshness,
            )
        )

    return LatestPricesOut(items=items)


@router.get("/history", response_model=PriceHistoryOut)
async def get_price_history(
    asset_code: str = Query(min_length=1),
    limit: int = Query(default=50, ge=1, le=500),
    range: str | None = Query(default=None, description="e.g. 1d,7d,30d,90d for chart efficiency"),
    db: AsyncSession = Depends(get_db),
) -> PriceHistoryOut:
    service = PriceQueryService(db)

    since: datetime | None = None
    if range:
        now = datetime.now(timezone.utc)
        days = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}.get(range.lower(), None)
        if days:
            since = now - timedelta(days=days)

    rows = await service.price_history(asset_code, limit, since=since)

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


@router.get("/suggestions", response_model=SuggestionsOut)
async def get_suggestions(
    watched: str | None = Query(
        default=None, description="comma-separated watched asset_codes to exclude"
    ),
    limit: int = Query(default=4, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsOut:
    """Smart suggestions for unwatched assets with recent move signals (change %).
    Powers 'پیشنهادهای هوشمند' in TWA for better discovery and alert creation rate.
    """
    service = PriceQueryService(db)
    watched_list = [w.strip() for w in (watched or "").split(",") if w.strip()]
    raw = await service.suggestions(watched_list, limit)
    items = [
        SuggestionItemOut(
            asset_code=r["asset_code"],
            asset_name=r["asset_name"],
            price_value=r["price_value"],
            display_unit=r["display_unit"],
            change_pct=r.get("change_pct"),
            volatility=r.get("volatility"),
            reason=r.get("reason", "unwatched"),
        )
        for r in raw
    ]
    return SuggestionsOut(items=items)


@router.post("/test/override-price")
async def test_override_price(
    payload: dict[str, Any],
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Test / Playground price override for the Smart Dashboard (mini-app) and developers.
    Updates LatestPrice so that the next alert evaluation can see the forced price.
    Real price ingest (every ~10min) will typically overwrite this.
    Useful for testing alert triggers without waiting for market moves.
    Requires ADMIN_ACCESS_TOKEN via Authorization header or ?token= query param.
    """
    auth_token = authorization or token
    if not auth_token:
        raise HTTPException(
            status_code=401,
            detail=AUTH_ADMIN_TOKEN_REQUIRED,
        )

    # Strip Bearer prefix if present
    if auth_token.startswith("Bearer "):
        auth_token = auth_token[len("Bearer ") :]

    expected_admin = os.environ.get("ADMIN_ACCESS_TOKEN") or getattr(
        settings, "admin_access_token", None
    )
    if not expected_admin:
        raise HTTPException(
            status_code=500,
            detail="توکن مدیریت پیکربندی نشده است. لطفاً متغیر ADMIN_ACCESS_TOKEN را تنظیم کنید.",
        )

    if not hmac.compare_digest(auth_token, expected_admin):
        raise HTTPException(
            status_code=403,
            detail="توکن مدیریت نامعتبر است. دسترسی به این عملیات محدود به مدیران است.",
        )

    symbol = payload.get("symbol") or payload.get("asset_code")
    price_val = payload.get("price") or payload.get("targetPrice")
    if not symbol or price_val is None:
        raise HTTPException(400, "symbol و price الزامی هستند")

    try:
        price = float(price_val)
    except Exception:
        raise HTTPException(400, "قیمت نامعتبر است") from None

    # Alias map so the mini-app's asset symbols work against real seeded assets
    aliases = {
        "BTC": "BTC_USDT",
        "ETH": "ETH_USDT",
        "SOL": "SOL",  # may need seed later
        "TON": "TON",  # may need seed later
        "GOLD18": "GOLD_18K_IRT",
        "COIN_EMAMI": "SEKKEH_EMAMI_IRT",
        "USD_IRT": "USD_IRT",
        "USDT_IRT": "USDT_IRT",
        "EUR_IRT": "EUR_IRT",
    }
    real_symbol = aliases.get(symbol, symbol)

    asset_res = await db.execute(
        select(Asset).where(
            (Asset.symbol == real_symbol)
            | (Asset.canonical_id == real_symbol)
            | (Asset.symbol == symbol)
        )
    )
    asset = asset_res.scalar_one_or_none()
    if not asset:
        raise HTTPException(
            404,
            f"دارایی برای symbol={symbol} یافت نشد (امتحان شده: {real_symbol})",
        )

    now = datetime.now(timezone.utc)

    lp_res = await db.execute(select(LatestPrice).where(LatestPrice.asset_id == asset.id))
    lp = lp_res.scalar_one_or_none()

    if lp:
        lp.price = Decimal(str(round(price, 8)))
        lp.observed_at = now
        lp.fetched_at = now
        lp.is_stale = False
        lp.raw_data = {"source": "studio-simulator", "forced_by": "admin_override"}
    else:
        lp = LatestPrice(
            asset_id=asset.id,
            price=Decimal(str(round(price, 8))),
            observed_at=now,
            fetched_at=now,
            is_stale=False,
            raw_data={"source": "studio-simulator", "forced_by": "admin_override"},
        )
        db.add(lp)

    await db.commit()

    return {
        "success": True,
        "asset_code": asset.symbol,
        "display_name": asset.display_name or asset.name,
        "forced_price": price,
        "note": (
            "Price injected for testing. "
            "Next evaluation (worker/cron) will consider it. "
            "Real ingest will refresh soon."
        ),
    }


@router.post("/ingest")
async def ingest_prices(
    payload: dict[str, Any] | list[dict[str, Any]],
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Ingest prices from external sources (GitHub Actions, etc.)
    This endpoint is used by the price fetcher running on GitHub Actions
    to avoid IP blocking on Iranian VPS.
    """
    # Verify API token (prefer real os.environ as PM2 may set it after settings cache)
    expected_token = os.environ.get("INGEST_API_TOKEN") or getattr(
        settings, "ingest_api_token", None
    )
    if not expected_token:
        raise HTTPException(
            status_code=500,
            detail=(
                "توکن ورودی قیمت‌ها پیکربندی نشده است. لطفاً متغیر INGEST_API_TOKEN را تنظیم کنید."
            ),
        )

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="هدر Authorization الزامی است. فرمت: Bearer <token>",
        )

    token = (
        authorization.replace("Bearer ", "")
        if authorization.startswith("Bearer ")
        else authorization
    )
    if token != expected_token:
        raise HTTPException(
            status_code=403,
            detail="توکن نامعتبر است. لطفاً مطمئن شوید INGEST_API_TOKEN صحیح است.",
        )

    price_service = PriceService(db)
    success_count = 0
    errors = []

    # Support both {"items": [...]} (from fetch_prices_to_vps.py) and raw list
    if isinstance(payload, dict) and "items" in payload:
        items = payload.get("items", [])
    else:
        items = payload if isinstance(payload, list) else []

    for item in items:
        try:
            asset_code = item.get("asset_code") or item.get("symbol")
            if not asset_code:
                errors.append({"item": item, "error": "asset_code موجود نیست"})
                continue

            # Resolve asset by symbol (e.g. BTC, USD_IRT, BTC_USDT)
            stmt = select(Asset).where(Asset.symbol == asset_code)
            result = await db.execute(stmt)
            asset = result.scalar_one_or_none()

            if asset is None:
                # Flexible mapping for GH fetcher which sends "BTC" etc.
                candidates = [
                    asset_code,
                    f"{asset_code}_USDT",
                    f"{asset_code}_IRT",
                    asset_code.replace("_IRT", "").replace("_USDT", ""),
                ]
                for cand in candidates:
                    if cand == asset_code:
                        continue
                    stmt2 = select(Asset).where(Asset.symbol == cand)
                    r2 = await db.execute(stmt2)
                    asset = r2.scalar_one_or_none()
                    if asset:
                        break

            if asset is None:
                errors.append({"asset_code": asset_code, "error": "دارایی در پایگاه داده یافت نشد"})
                continue

            # Resolve or create provider
            provider_slug = item.get("provider", "external_ingest")
            prov_stmt = select(Provider).where(Provider.slug == provider_slug)
            prov_result = await db.execute(prov_stmt)
            provider = prov_result.scalar_one_or_none()

            if provider is None:
                provider = Provider(
                    slug=provider_slug,
                    name=provider_slug.replace("_", " ").title(),
                    priority=50,
                    is_active=True,
                )
                db.add(provider)
                await db.commit()
                await db.refresh(provider)

            price_value = float(item.get("price_value") or item.get("price") or 0)

            fetched_at_str = item.get("fetched_at")
            if fetched_at_str:
                try:
                    observed_at = datetime.fromisoformat(fetched_at_str.replace("Z", "+00:00"))
                except Exception:
                    observed_at = datetime.now(timezone.utc)
            else:
                observed_at = datetime.now(timezone.utc)

            price_point = PricePoint(
                symbol=asset_code,
                price=Decimal(str(price_value)),
                observed_at=observed_at,
                fetched_at=observed_at,
                raw_data=item,
            )

            await price_service.save_price(
                asset_id=asset.id,
                provider_id=provider.id,
                price_point=price_point,
            )
            success_count += 1
            emit_event(
                "price_ingested",
                asset_code=asset_code,
                provider=provider_slug,
                price=str(price_value),
                observed_at=observed_at.isoformat(),
            )

        except Exception as e:
            errors.append({"item": item.get("asset_code"), "error": "پردازش آیتم ناموفق بود"})
            record_metric("price_ingest_error")
            emit_event("price_ingest_error", asset_code=asset_code, error=str(e))

    return {
        "status": "success" if success_count > 0 else "partial",
        "processed": success_count,
        "total": len(items),
        "errors": errors[:5] if errors else None,  # limit error reporting
    }
