import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.errors import UnauthorizedError
from novax_price_alert.api.schemas.metrics import MetricsOut
from novax_price_alert.api.schemas.operations import OperationalSummaryOut
from novax_price_alert.application.services.operational_summary_service import (
    OperationalSummaryService,
)
from novax_price_alert.core.observability import get_metrics_snapshot
from novax_price_alert.core.settings import settings

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _metrics_requires_token() -> bool:
    return bool(settings.metrics_access_token) or settings.environment.lower() == "production"


def _verify_metrics_token(token: str | None) -> None:
    if not _metrics_requires_token():
        return
    if not settings.metrics_access_token or token is None:
        raise UnauthorizedError("valid metrics token is required")
    if not hmac.compare_digest(token, settings.metrics_access_token):
        raise UnauthorizedError("valid metrics token is required")


@router.get("", response_model=MetricsOut)
async def get_metrics(
    x_metrics_token: Annotated[str | None, Header()] = None,
) -> MetricsOut:
    _verify_metrics_token(x_metrics_token)
    return MetricsOut(metrics=get_metrics_snapshot())


@router.get("/summary", response_model=OperationalSummaryOut)
async def get_operational_summary(
    x_metrics_token: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> OperationalSummaryOut:
    _verify_metrics_token(x_metrics_token)
    return await OperationalSummaryService(db).summary()
