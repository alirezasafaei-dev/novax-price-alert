from collections.abc import Sequence
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from novax_price_alert.api.i18n import ALERT_MAX_ACTIVE_REACHED
from novax_price_alert.core.observability import emit_event, record_metric
from novax_price_alert.core.settings import settings
from novax_price_alert.domain.alert_rule import AlertRule, InvalidAlertTransitionError
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.enums import AlertLifecycleState
from novax_price_alert.domain.pricing import normalize_price


class AlertLimitReachedError(ValueError):
    pass


class AlertCRUDService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_alerts(self, user_id: str) -> Sequence[AlertRule]:
        stmt = (
            select(AlertRule)
            .options(selectinload(AlertRule.asset))
            .where(AlertRule.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, alert: AlertRule) -> AlertRule:
        await self._ensure_user_alert_capacity(alert.user_id)
        alert.target_price = normalize_price(alert.target_price)
        if not alert.canonical_asset_id:
            asset = getattr(alert, "asset", None)
            if asset is None:
                asset = await self.session.get(Asset, alert.asset_id)
            alert.canonical_asset_id = asset.canonical_id if asset is not None else alert.asset_id

        self.session.add(alert)
        await self.session.commit()
        await self.session.refresh(alert)
        record_metric("alert_creation_count")
        emit_event(
            "alert_created",
            alert_id=alert.id,
            user_id=alert.user_id,
            canonical_asset_id=alert.canonical_asset_id,
            display_asset_name_at_creation=alert.display_asset_name_at_creation,
            target_price=str(alert.target_price),
            target_price_display_unit=alert.target_price_display_unit,
            lifecycle_state=str(alert.lifecycle_state),
        )
        return alert

    async def _ensure_user_alert_capacity(self, user_id: str) -> None:
        stmt = (
            select(func.count())
            .select_from(AlertRule)
            .where(
                AlertRule.user_id == user_id,
                AlertRule.lifecycle_state.in_(
                    (
                        AlertLifecycleState.PENDING_CONFIRMATION,
                        AlertLifecycleState.ACTIVE,
                        AlertLifecycleState.PAUSED,
                        AlertLifecycleState.FAILED,
                    )
                ),
            )
        )
        count = (await self.session.execute(stmt)).scalar_one()
        if count >= settings.max_alerts_per_user:
            raise AlertLimitReachedError(ALERT_MAX_ACTIVE_REACHED)

    async def get_for_user(self, alert_id: str, user_id: str) -> AlertRule | None:
        stmt = (
            select(AlertRule)
            .options(selectinload(AlertRule.asset))
            .where(AlertRule.id == alert_id, AlertRule.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def confirm(self, alert_id: str, user_id: str) -> AlertRule | None:
        alert = await self.get_for_user(alert_id, user_id)
        if alert is None:
            return None
        try:
            alert.transition_to(AlertLifecycleState.ACTIVE)
        except InvalidAlertTransitionError:
            record_metric("invalid_transition_count")
            emit_event(
                "invalid_transition_detected",
                alert_id=alert.id,
                user_id=alert.user_id,
                from_state=str(alert.lifecycle_state),
                to_state=AlertLifecycleState.ACTIVE.value,
            )
            raise
        now = datetime.now(timezone.utc)
        alert.confirmed_at = now
        await self.session.commit()
        await self.session.refresh(alert)
        record_metric("alert_flow_completion_count")
        emit_event(
            "alert_confirmed",
            alert_id=alert.id,
            user_id=alert.user_id,
            canonical_asset_id=alert.canonical_asset_id,
            confirmed_at=now.isoformat(),
        )
        emit_event(
            "alert_activated",
            alert_id=alert.id,
            user_id=alert.user_id,
            canonical_asset_id=alert.canonical_asset_id,
        )
        return alert

    async def update(
        self,
        alert_id: str,
        user_id: str,
        *,
        target_price: Decimal | None = None,
        cooldown_minutes: int | None = None,
        is_active: bool | None = None,
    ) -> AlertRule | None:
        alert = await self.get_for_user(alert_id, user_id)

        if alert is None:
            return None

        if target_price is not None:
            alert.target_price = normalize_price(target_price)
            if alert.lifecycle_state == AlertLifecycleState.ACTIVE:
                alert.transition_to(AlertLifecycleState.PAUSED)
            if alert.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION:
                alert.transition_to(AlertLifecycleState.AWAITING_TARGET_PRICE)
                alert.transition_to(AlertLifecycleState.PENDING_CONFIRMATION)
        if cooldown_minutes is not None:
            alert.cooldown_minutes = cooldown_minutes
        if is_active is not None:
            if is_active:
                if alert.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION:
                    raise InvalidAlertTransitionError(
                        alert.lifecycle_state,
                        AlertLifecycleState.ACTIVE,
                    )
                alert.transition_to(AlertLifecycleState.ACTIVE)
                alert.confirmed_at = datetime.now(timezone.utc)
            else:
                alert.transition_to(AlertLifecycleState.PAUSED)
        await self.session.commit()
        await self.session.refresh(alert)
        emit_event(
            "alert_updated",
            alert_id=alert.id,
            user_id=alert.user_id,
            canonical_asset_id=alert.canonical_asset_id,
            lifecycle_state=str(alert.lifecycle_state),
        )
        return alert

    async def deactivate(self, alert_id: str, user_id: str) -> AlertRule | None:
        alert = await self.get_for_user(alert_id, user_id)
        if alert is None:
            return None
        alert.transition_to(AlertLifecycleState.CANCELLED)
        alert.cancelled_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(alert)
        emit_event(
            "alert_cancelled",
            alert_id=alert.id,
            user_id=alert.user_id,
            canonical_asset_id=alert.canonical_asset_id,
        )
        return alert
