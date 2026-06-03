from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.alert_crud_service import AlertCRUDService
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule, InvalidAlertTransitionError
from novax_price_alert.domain.enums import AlertCondition, AlertEventStatus, AlertLifecycleState
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.infra.notifications.base import BaseNotificationSender
from novax_price_alert.services.alert_evaluator import AlertEvaluatorService
from novax_price_alert.services.notification_dispatcher import NotificationDispatcherService


class CountingSender(BaseNotificationSender):
    def __init__(self, fail_first: bool = False) -> None:
        self.sent_event_ids: list[str] = []
        self.fail_first = fail_first

    async def send(self, event: AlertEvent) -> None:
        self.sent_event_ids.append(event.event_id)
        if self.fail_first:
            self.fail_first = False
            raise RuntimeError("temporary telegram failure")


@pytest.mark.anyio
async def test_alert_creation_requires_confirmation(db_session: AsyncSession) -> None:
    alert = AlertRule(
        user_id="user-1",
        asset_id="asset-1",
        display_asset_name_at_creation="USD",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )
    service = AlertCRUDService(db_session)

    created = await service.create(alert)

    assert created.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION
    assert created.is_active is False

    confirmed = await service.confirm(created.id, "user-1")

    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert confirmed.is_active is True
    assert confirmed.confirmed_at is not None


@pytest.mark.anyio
async def test_invalid_state_transition_is_rejected() -> None:
    alert = AlertRule(
        user_id="user-1",
        asset_id="asset-1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("100"),
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )

    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.DELIVERED)


@pytest.mark.anyio
async def test_stale_data_blocks_trigger(db_session: AsyncSession) -> None:
    observed_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.add_all(
        [
            LatestPrice(
                asset_id="asset-1",
                provider_id="provider-1",
                price=Decimal("150"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id="user-1",
                asset_id="asset-1",
                condition_type=AlertCondition.ABOVE,
                target_price=Decimal("100"),
                cooldown_minutes=0,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset("asset-1")

    assert events == []


@pytest.mark.anyio
async def test_unavailable_provider_blocks_trigger(db_session: AsyncSession) -> None:
    db_session.add(
        AlertRule(
            user_id="user-1",
            asset_id="asset-1",
            condition_type=AlertCondition.ABOVE,
            target_price=Decimal("100"),
            cooldown_minutes=0,
            lifecycle_state=AlertLifecycleState.ACTIVE,
            is_active=True,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset("asset-1")

    assert events == []


@pytest.mark.anyio
async def test_notification_retry_does_not_duplicate_successful_send(
    db_session: AsyncSession,
) -> None:
    event = AlertEvent(
        alert_rule_id="rule-1",
        event_id="event-1",
        idempotency_key="notification:event-1",
        triggered_price=Decimal("150"),
        triggered_at=datetime.now(timezone.utc),
        status=AlertEventStatus.PENDING,
    )
    db_session.add(event)
    await db_session.commit()

    sender = CountingSender()
    dispatcher = NotificationDispatcherService(db_session, sender)

    first = await dispatcher.dispatch_pending_events(worker_run_id="worker-1")
    second = await dispatcher.dispatch_pending_events(worker_run_id="worker-2")

    assert first == 1
    assert second == 0
    assert sender.sent_event_ids == ["event-1"]


@pytest.mark.anyio
async def test_failed_send_retries_same_event_identity(db_session: AsyncSession) -> None:
    event = AlertEvent(
        alert_rule_id="rule-1",
        event_id="event-1",
        idempotency_key="notification:event-1",
        triggered_price=Decimal("150"),
        triggered_at=datetime.now(timezone.utc),
        status=AlertEventStatus.PENDING,
    )
    db_session.add(event)
    await db_session.commit()

    sender = CountingSender(fail_first=True)
    dispatcher = NotificationDispatcherService(db_session, sender, retry_backoff_seconds=0)

    assert await dispatcher.dispatch_pending_events(worker_run_id="worker-1") == 0
    assert await dispatcher.dispatch_pending_events(worker_run_id="worker-2") == 1

    assert sender.sent_event_ids == ["event-1", "event-1"]
    refreshed = await db_session.get(AlertEvent, event.id)
    assert refreshed is not None
    assert refreshed.status == AlertEventStatus.SENT


@pytest.mark.anyio
async def test_concurrent_claim_allows_only_one_worker_to_finalize(
    db_session: AsyncSession,
) -> None:
    event = AlertEvent(
        alert_rule_id="rule-1",
        event_id="event-1",
        idempotency_key="notification:event-1",
        triggered_price=Decimal("150"),
        triggered_at=datetime.now(timezone.utc),
        status=AlertEventStatus.PENDING,
    )
    db_session.add(event)
    await db_session.commit()

    dispatcher = NotificationDispatcherService(db_session, CountingSender())

    first_claim = await dispatcher._claim_event(event.id, "worker-1")
    second_claim = await dispatcher._claim_event(event.id, "worker-2")

    assert first_claim is not None
    assert second_claim is None

    result = await db_session.execute(select(AlertEvent).where(AlertEvent.id == event.id))
    refreshed = result.scalar_one()
    assert refreshed.worker_run_id == "worker-1"
    assert refreshed.status == AlertEventStatus.DELIVERY_IN_PROGRESS


@pytest.mark.anyio
async def test_structured_lifecycle_logs_are_emitted(
    db_session: AsyncSession,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("INFO", logger="novax_price_alert.lifecycle")
    alert = AlertRule(
        user_id="user-1",
        asset_id="asset-1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("100"),
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )

    created = await AlertCRUDService(db_session).create(alert)
    await AlertCRUDService(db_session).confirm(created.id, "user-1")

    assert {record.__dict__["event_name"] for record in caplog.records} >= {
        "alert_created",
        "alert_confirmed",
        "alert_activated",
    }


@pytest.mark.anyio
async def test_direct_activation_from_pending_without_confirm_timestamp_is_rejected(
    db_session: AsyncSession,
) -> None:
    alert = AlertRule(
        user_id="user-1",
        asset_id="asset-1",
        display_asset_name_at_creation="USD",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )
    service = AlertCRUDService(db_session)
    created = await service.create(alert)

    with pytest.raises(InvalidAlertTransitionError):
        await service.update(created.id, "user-1", is_active=True)

    refreshed = await service.get_for_user(created.id, "user-1")
    assert refreshed is not None
    assert refreshed.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION
    assert refreshed.is_active is False
    assert refreshed.confirmed_at is None
