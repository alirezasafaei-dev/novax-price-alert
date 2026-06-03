from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.deps import get_current_telegram_user, get_db
from novax_price_alert.api.errors import NotFoundError
from novax_price_alert.api.schemas.alert import (
    AlertCreateIn,
    AlertListOut,
    AlertOut,
    AlertUpdateIn,
    DeleteAlertOut,
)
from novax_price_alert.application.services.alert_crud_service import AlertCRUDService
from novax_price_alert.application.services.user_resolver_service import UserResolverService
from novax_price_alert.domain.alert_rule import AlertRule, InvalidAlertTransitionError
from novax_price_alert.domain.enums import AlertLifecycleState
from novax_price_alert.domain.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreateIn,
    current_user: Annotated[User, Depends(get_current_telegram_user)],
    db: AsyncSession = Depends(get_db),
) -> AlertOut:
    alerts = AlertCRUDService(db)
    resolver = UserResolverService(db)

    asset = await resolver.resolve_asset(payload.asset_code)
    if asset is None:
        raise NotFoundError("asset not found")

    display_name = asset.display_name or asset.name or asset.symbol
    alert = AlertRule(
        user_id=current_user.id,
        asset_id=asset.id,
        display_asset_name_at_creation=display_name,
        condition_type=payload.condition_type,
        target_price=payload.target_price,
        target_price_display_unit=asset.unit,
        cooldown_minutes=payload.cooldown_minutes,
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )

    created = await alerts.create(alert)
    if payload.confirm:
        confirmed = await alerts.confirm(created.id, current_user.id)
        if confirmed is not None:
            created = confirmed
    return AlertOut.model_validate(created)


@router.post("/{alert_id}/confirm", response_model=AlertOut)
async def confirm_alert(
    alert_id: str,
    current_user: Annotated[User, Depends(get_current_telegram_user)],
    db: AsyncSession = Depends(get_db),
) -> AlertOut:
    alerts = AlertCRUDService(db)
    try:
        confirmed = await alerts.confirm(alert_id, current_user.id)
    except InvalidAlertTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if confirmed is None:
        raise NotFoundError("alert not found")
    return AlertOut.model_validate(confirmed)


@router.get("", response_model=AlertListOut)
async def list_alerts(
    current_user: Annotated[User, Depends(get_current_telegram_user)],
    db: AsyncSession = Depends(get_db),
) -> AlertListOut:
    alerts = AlertCRUDService(db)
    rows = await alerts.list_alerts(current_user.id)
    return AlertListOut(items=[AlertOut.model_validate(row) for row in rows])


@router.patch("/{alert_id}", response_model=AlertOut)
async def update_alert(
    alert_id: str,
    payload: AlertUpdateIn,
    current_user: Annotated[User, Depends(get_current_telegram_user)],
    db: AsyncSession = Depends(get_db),
) -> AlertOut:
    alerts = AlertCRUDService(db)
    updated = await alerts.update(
        alert_id,
        current_user.id,
        target_price=payload.target_price,
        cooldown_minutes=payload.cooldown_minutes,
        is_active=payload.is_active,
    )
    if updated is None:
        raise NotFoundError("alert not found")
    return AlertOut.model_validate(updated)


@router.delete("/{alert_id}", response_model=DeleteAlertOut)
async def delete_alert(
    alert_id: str,
    current_user: Annotated[User, Depends(get_current_telegram_user)],
    db: AsyncSession = Depends(get_db),
) -> DeleteAlertOut:
    alerts = AlertCRUDService(db)
    updated = await alerts.deactivate(alert_id, current_user.id)
    if updated is None:
        raise NotFoundError("alert not found")
    return DeleteAlertOut()
