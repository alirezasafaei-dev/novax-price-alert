from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.api.deps import get_db
from bale_price_alert.api.errors import NotFoundError
from bale_price_alert.api.schemas.alert import AlertCreateIn, AlertOut
from bale_price_alert.application.services.alert_crud_service import AlertCRUDService
from bale_price_alert.application.services.user_resolver_service import UserResolverService
from bale_price_alert.domain.alert_rule import AlertRule

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreateIn,
    db: AsyncSession = Depends(get_db),
) -> AlertOut:
    alerts = AlertCRUDService(db)
    resolver = UserResolverService(db)

    user = await resolver.resolve_user(payload.bale_user_id)
    if user is None:
        raise NotFoundError("user not found")

    asset = await resolver.resolve_asset(payload.asset_code)
    if asset is None:
        raise NotFoundError("asset not found")

    alert = AlertRule(
        user_id=user.id,
        asset_id=asset.id,
        condition_type=payload.condition_type,
        target_price=payload.target_price,
        cooldown_minutes=payload.cooldown_minutes,
        is_active=True,
    )

    created = await alerts.create(alert)
    return AlertOut.model_validate(created)
