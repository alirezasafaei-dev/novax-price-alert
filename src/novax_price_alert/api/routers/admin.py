import hmac
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.errors import UnauthorizedError
from novax_price_alert.api.i18n import (
    ALERT_NOT_FOUND,
    AUTH_ADMIN_TOKEN_INVALID,
    AUTH_ADMIN_TOKEN_MISSING,
)
from novax_price_alert.application.services.admin_audit_service import AdminAuditService
from novax_price_alert.core.settings import settings
from novax_price_alert.domain.alert_rule import AlertRule
from novax_price_alert.domain.enums import AlertLifecycleState
from novax_price_alert.domain.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


def _verify_admin_token(token: str | None) -> None:
    if not settings.admin_access_token:
        if settings.environment.lower() == "production":
            raise UnauthorizedError(AUTH_ADMIN_TOKEN_MISSING)
        return
    if token is None or not hmac.compare_digest(token, settings.admin_access_token):
        raise UnauthorizedError(AUTH_ADMIN_TOKEN_INVALID)


@router.get("/overview")
async def admin_overview(
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Professional admin overview. Supports token via header or ?token= query for easy
    bookmarking."""
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)

    # Alerts by state
    alerts_by_state = {}
    for state in [
        "PENDING_CONFIRMATION",
        "ACTIVE",
        "TRIGGERED",
        "DELIVERED",
        "CANCELLED",
        "FAILED",
    ]:
        count = (
            await db.execute(
                select(func.count())
                .select_from(AlertRule)
                .where(AlertRule.lifecycle_state == state)
            )
        ).scalar_one()
        if count > 0:
            alerts_by_state[state] = count

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_alerts = (
        await db.execute(select(func.count()).select_from(AlertRule).where(AlertRule.is_active))
    ).scalar_one()

    return {
        "total_users": total_users,
        "active_alerts": active_alerts,
        "alerts_by_state": alerts_by_state,
        "environment": settings.environment,
    }


@router.get("/alerts")
async def admin_list_alerts(
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List alerts across all users (admin only)."""
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)

    stmt = select(AlertRule).options().order_by(AlertRule.created_at.desc()).limit(limit)
    if state:
        stmt = stmt.where(AlertRule.lifecycle_state == state)

    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for a in rows:
        items.append(
            {
                "id": a.id,
                "user_id": a.user_id,
                "asset_code": getattr(a, "canonical_asset_id", None) or a.asset_id,
                "display_name": a.display_asset_name_at_creation,
                "state": str(a.lifecycle_state),
                "is_active": a.is_active,
                "target_price": str(a.target_price),
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "last_triggered_at": a.last_triggered_at.isoformat()
                if a.last_triggered_at
                else None,
            }
        )

    return {"items": items, "count": len(items)}


@router.get("/users")
async def admin_list_users(
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)

    stmt = select(User).order_by(User.created_at.desc()).limit(limit)
    users = (await db.execute(stmt)).scalars().all()

    items = []
    for u in users:
        items.append(
            {
                "id": u.id,
                "telegram_user_id": u.telegram_user_id,
                "username": u.username,
                "first_name": u.first_name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
        )

    return {"items": items}


@router.post("/alerts/{alert_id}/cancel")
async def admin_cancel_alert(
    alert_id: str,
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Admin force cancel an alert (bypasses user ownership)."""
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)

    alert = await db.get(AlertRule, alert_id)
    if not alert:
        raise HTTPException(404, ALERT_NOT_FOUND)

    if alert.lifecycle_state in (
        AlertLifecycleState.DELIVERED,
        AlertLifecycleState.CANCELLED,
        AlertLifecycleState.FAILED,
    ):
        return {"status": "noop", "message": "already terminal"}

    alert.lifecycle_state = AlertLifecycleState.CANCELLED
    alert.is_active = False
    await db.commit()

    await AdminAuditService(db).log_action(
        "cancel_alert",
        target_type="alert",
        target_id=alert_id,
        details={"previous_state": str(alert.lifecycle_state)},
    )

    return {"status": "cancelled", "alert_id": alert_id}


@router.post("/actions/broadcast")
async def admin_broadcast(
    payload: dict[str, Any],
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Admin broadcast stub (logs the intent; real send can be wired to bot later)."""
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)
    message = payload.get("message", "")
    target = payload.get("target", "all")
    await AdminAuditService(db).log_action(
        "broadcast_attempt", details={"message_preview": message[:100], "target": target}
    )
    # In real: integrate with bot to send to users
    return {
        "status": "logged",
        "note": "Broadcast intent recorded. Wire to actual bot sender for delivery.",
    }


@router.post("/actions/refresh-metrics")
async def admin_refresh_metrics(
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Lightweight action to bump internal counters if needed."""
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)
    from novax_price_alert.core.observability import record_metric

    record_metric("admin_manual_refresh")
    await AdminAuditService(db).log_action("refresh_metrics")
    return {"status": "ok"}


@router.get("/audit-logs")
async def admin_audit_logs(
    x_admin_token: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Recent admin actions for audit."""
    auth_token = x_admin_token or token
    _verify_admin_token(auth_token)
    logs = await AdminAuditService(db).list_recent(limit)
    return {
        "items": [
            {
                "id": log.id,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "details": log.details,
                "performed_at": log.performed_at.isoformat(),
                "actor": log.actor,
            }
            for log in logs
        ]
    }
