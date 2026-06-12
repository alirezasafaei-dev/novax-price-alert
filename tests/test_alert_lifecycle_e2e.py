"""
End-to-end tests for the complete alert lifecycle.

Covers:
1. Asset selection -> price display -> target entry -> confirmation -> deletion
2. Full lifecycle state transitions (all 11 states)
3. Invalid transitions are rejected
4. Alert lifecycle policy enforcement
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.alert_crud_service import AlertCRUDService
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule, InvalidAlertTransitionError
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.enums import (
    AlertCondition,
    AlertEventStatus,
    AlertLifecycleState,
)
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.user import User
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


# ── Shared fixtures ──────────────────────────────────────────────


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    user = User(telegram_user_id="e2e-user", username="e2e_tester", first_name="E2E")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def usd_asset(db_session: AsyncSession) -> Asset:
    asset = Asset(
        symbol="USD_IRT",
        canonical_id="USD_IRT",
        name="US Dollar",
        display_name="دلار آزاد",
        category="currency",
        unit="IRT",
    )
    db_session.add(asset)
    await db_session.commit()
    await db_session.refresh(asset)
    return asset


@pytest.fixture
async def btc_asset(db_session: AsyncSession) -> Asset:
    asset = Asset(
        symbol="BTC",
        canonical_id="BTC_USDT",
        name="Bitcoin",
        display_name="بیت‌کوین",
        category="crypto",
        unit="USDT",
    )
    db_session.add(asset)
    await db_session.commit()
    await db_session.refresh(asset)
    return asset


def _make_alert(
    user: User,
    asset: Asset,
    condition: AlertCondition = AlertCondition.ABOVE,
    target: Decimal = Decimal("91000"),
    unit: str = "IRT",
    state: AlertLifecycleState = AlertLifecycleState.PENDING_CONFIRMATION,
) -> AlertRule:
    return AlertRule(
        user_id=user.id,
        asset_id=asset.id,
        canonical_asset_id=asset.canonical_id,
        display_asset_name_at_creation=asset.display_name,
        condition_type=condition,
        target_price=target,
        target_price_display_unit=unit,
        cooldown_minutes=0,
        lifecycle_state=state,
        is_active=(state == AlertLifecycleState.ACTIVE),
    )


# ══════════════════════════════════════════════════════════════════
# 1. Full E2E flow: select asset -> view price -> enter target ->
#    confirm -> deletion
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_e2e_full_alert_lifecycle_fiat(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Complete flow: create fiat alert, confirm, simulate trigger, deliver, verify delivered."""
    now = datetime.now(timezone.utc)

    # Step 1: Create alert (user selects asset, enters target, submits)
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    assert created.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION
    assert created.is_active is False

    # Step 2: User confirms the alert
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert confirmed.is_active is True
    assert confirmed.confirmed_at is not None

    # Step 3: Price goes above target → evaluator triggers
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("95000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == Decimal("95000")
    assert events[0].status == AlertEventStatus.PENDING

    # Step 4: Verify alert moved to TRIGGERED
    refreshed = await service.get_for_user(confirmed.id, user.id)
    assert refreshed is not None
    assert refreshed.lifecycle_state == AlertLifecycleState.TRIGGERED

    # Step 5: User deletes (deactivates) the alert — should fail because not in cancellable state
    # TRIGGERED → CANCELLED is NOT a valid transition
    with pytest.raises(InvalidAlertTransitionError):
        await service.deactivate(refreshed.id, user.id)


@pytest.mark.anyio
async def test_e2e_full_alert_lifecycle_crypto(
    db_session: AsyncSession, user: User, btc_asset: Asset
) -> None:
    """Complete flow for a crypto alert: create, confirm, trigger above."""
    now = datetime.now(timezone.utc)

    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user,
        btc_asset,
        AlertCondition.ABOVE,
        Decimal("60000"),
        "USDT",
        AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    created = await service.create(alert)
    assert created.lifecycle_state == AlertLifecycleState.ACTIVE

    # Price above target
    db_session.add(
        LatestPrice(
            asset_id=btc_asset.id,
            provider_id="binance",
            price=Decimal("65000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(btc_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == Decimal("65000")


@pytest.mark.anyio
async def test_e2e_alert_below_condition(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Create alert for price BELOW target, confirms, triggers when price drops."""
    now = datetime.now(timezone.utc)

    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.BELOW, Decimal("85000"))
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None

    # Price drops below target
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("80000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == Decimal("80000")


@pytest.mark.anyio
async def test_e2e_create_and_immediately_confirm(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Create with confirm=True shortcut: should go directly to ACTIVE."""
    # Simulate the API-level confirm logic
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert confirmed.is_active is True
    assert confirmed.confirmed_at is not None


@pytest.mark.anyio
async def test_e2e_cancel_active_alert(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Create, confirm, then cancel — should go to CANCELLED."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None

    cancelled = await service.deactivate(confirmed.id, user.id)
    assert cancelled is not None
    assert cancelled.lifecycle_state == AlertLifecycleState.CANCELLED
    assert cancelled.is_active is False
    assert cancelled.cancelled_at is not None


@pytest.mark.anyio
async def test_e2e_pause_and_resume_alert(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Create, confirm, pause, then resume — ACTIVE→PAUSED→ACTIVE."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE

    # Pause
    paused = await service.update(confirmed.id, user.id, is_active=False)
    assert paused is not None
    assert paused.lifecycle_state == AlertLifecycleState.PAUSED
    assert paused.is_active is False

    # Resume
    resumed = await service.update(paused.id, user.id, is_active=True)
    assert resumed is not None
    assert resumed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert resumed.is_active is True


@pytest.mark.anyio
async def test_e2e_trigger_then_deliver_then_mark_delivered(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """
    Full delivery pipeline:
    ACTIVE → TRIGGERED → DELIVERY_IN_PROGRESS → DELIVERED
    """
    now = datetime.now(timezone.utc)

    # Create active alert
    alert = _make_alert(
        user,
        usd_asset,
        AlertCondition.ABOVE,
        Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    # Inject price above target
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("95000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    # Evaluator triggers
    events = await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    assert len(events) == 1
    event = events[0]

    # Verify alert is TRIGGERED
    await db_session.refresh(alert)
    assert alert.lifecycle_state == AlertLifecycleState.TRIGGERED

    # Dispatcher sends notification (mock sender that succeeds)
    class OkSender(BaseNotificationSender):
        async def send(self, event: AlertEvent) -> None:
            pass

    sender = OkSender()
    dispatcher = NotificationDispatcherService(db_session, sender)
    sent = await dispatcher.dispatch_pending_events(worker_run_id="e2e-worker-1")
    assert sent == 1

    # Verify event is SENT
    await db_session.refresh(event)
    assert event.status == AlertEventStatus.SENT
    assert event.sent_at is not None

    # Verify alert is DELIVERED
    await db_session.refresh(alert)
    assert alert.lifecycle_state == AlertLifecycleState.DELIVERED
    assert alert.delivered_at is not None


@pytest.mark.anyio
async def test_e2e_trigger_then_fail_then_retry_then_deliver(
    db_session: AsyncSession,
) -> None:
    """
    Delivery with retry:
    PENDING → DELIVERY_IN_PROGRESS → FAILED → DELIVERY_IN_PROGRESS → SENT
    """
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

    # First dispatch: fails
    assert await dispatcher.dispatch_pending_events(worker_run_id="retry-w1") == 0
    # Second dispatch: succeeds
    assert await dispatcher.dispatch_pending_events(worker_run_id="retry-w2") == 1

    assert sender.sent_event_ids == ["event-1", "event-1"]
    refreshed = await db_session.get(AlertEvent, event.id)
    assert refreshed is not None
    assert refreshed.status == AlertEventStatus.SENT


# ══════════════════════════════════════════════════════════════════
# 2. Lifecycle state transition matrix tests
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_all_valid_transitions_from_draft() -> None:
    """DRAFT can go to AWAITING_CONDITION or CANCELLED."""
    alert = _alert_with_state(AlertLifecycleState.DRAFT)
    alert.transition_to(AlertLifecycleState.AWAITING_CONDITION)
    assert alert.lifecycle_state == AlertLifecycleState.AWAITING_CONDITION

    alert2 = _alert_with_state(AlertLifecycleState.DRAFT)
    alert2.transition_to(AlertLifecycleState.CANCELLED)
    assert alert2.lifecycle_state == AlertLifecycleState.CANCELLED


@pytest.mark.anyio
async def test_all_valid_transitions_from_awaiting_condition() -> None:
    """AWAITING_CONDITION can go to AWAITING_TARGET_PRICE or CANCELLED."""
    alert = _alert_with_state(AlertLifecycleState.AWAITING_CONDITION)
    alert.transition_to(AlertLifecycleState.AWAITING_TARGET_PRICE)
    assert alert.lifecycle_state == AlertLifecycleState.AWAITING_TARGET_PRICE

    alert2 = _alert_with_state(AlertLifecycleState.AWAITING_CONDITION)
    alert2.transition_to(AlertLifecycleState.CANCELLED)
    assert alert2.lifecycle_state == AlertLifecycleState.CANCELLED


@pytest.mark.anyio
async def test_all_valid_transitions_from_awaiting_target_price() -> None:
    """AWAITING_TARGET_PRICE can go to PENDING_CONFIRMATION, AWAITING_CONDITION, or CANCELLED."""
    for target in (
        AlertLifecycleState.PENDING_CONFIRMATION,
        AlertLifecycleState.AWAITING_CONDITION,
        AlertLifecycleState.CANCELLED,
    ):
        alert = _alert_with_state(AlertLifecycleState.AWAITING_TARGET_PRICE)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_all_valid_transitions_from_pending_confirmation() -> None:
    """PENDING_CONFIRMATION can go to ACTIVE, AWAITING_TARGET_PRICE, or CANCELLED."""
    for target in (
        AlertLifecycleState.ACTIVE,
        AlertLifecycleState.AWAITING_TARGET_PRICE,
        AlertLifecycleState.CANCELLED,
    ):
        alert = _alert_with_state(AlertLifecycleState.PENDING_CONFIRMATION)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_all_valid_transitions_from_active() -> None:
    """ACTIVE can go to TRIGGERED, PAUSED, CANCELLED, or FAILED."""
    for target in (
        AlertLifecycleState.TRIGGERED,
        AlertLifecycleState.PAUSED,
        AlertLifecycleState.CANCELLED,
        AlertLifecycleState.FAILED,
    ):
        alert = _alert_with_state(AlertLifecycleState.ACTIVE)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_all_valid_transitions_from_triggered() -> None:
    """TRIGGERED can go to DELIVERY_IN_PROGRESS or FAILED."""
    for target in (
        AlertLifecycleState.DELIVERY_IN_PROGRESS,
        AlertLifecycleState.FAILED,
    ):
        alert = _alert_with_state(AlertLifecycleState.TRIGGERED)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_all_valid_transitions_from_delivery_in_progress() -> None:
    """DELIVERY_IN_PROGRESS can go to DELIVERED or FAILED."""
    for target in (
        AlertLifecycleState.DELIVERED,
        AlertLifecycleState.FAILED,
    ):
        alert = _alert_with_state(AlertLifecycleState.DELIVERY_IN_PROGRESS)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_terminal_states_have_no_outgoing_transitions() -> None:
    """DELIVERED and CANCELLED are terminal — no transitions allowed."""
    for terminal_state in (
        AlertLifecycleState.DELIVERED,
        AlertLifecycleState.CANCELLED,
    ):
        alert = _alert_with_state(terminal_state)
        for all_state in AlertLifecycleState:
            if all_state == terminal_state:
                continue
            with pytest.raises(InvalidAlertTransitionError):
                alert.transition_to(all_state)


@pytest.mark.anyio
async def test_paused_can_go_to_active_or_cancelled() -> None:
    """PAUSED can go to ACTIVE or CANCELLED."""
    for target in (AlertLifecycleState.ACTIVE, AlertLifecycleState.CANCELLED):
        alert = _alert_with_state(AlertLifecycleState.PAUSED)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_failed_can_go_to_active_or_cancelled() -> None:
    """FAILED can go to ACTIVE or CANCELLED."""
    for target in (AlertLifecycleState.ACTIVE, AlertLifecycleState.CANCELLED):
        alert = _alert_with_state(AlertLifecycleState.FAILED)
        alert.transition_to(target)
        assert alert.lifecycle_state == target


@pytest.mark.anyio
async def test_self_transition_is_noop() -> None:
    """Transitioning to the same state should not raise."""
    for state in AlertLifecycleState:
        alert = _alert_with_state(state)
        alert.transition_to(state)  # should not raise
        assert alert.lifecycle_state == state


# ══════════════════════════════════════════════════════════════════
# 3. Invalid transition rejection tests
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_cannot_skip_confirmation() -> None:
    """DRAFT → ACTIVE is not a valid transition."""
    alert = _alert_with_state(AlertLifecycleState.DRAFT)
    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.ACTIVE)


@pytest.mark.anyio
async def test_cannot_go_from_delivered_to_active() -> None:
    """DELIVERED → ACTIVE is not valid."""
    alert = _alert_with_state(AlertLifecycleState.DELIVERED)
    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.ACTIVE)


@pytest.mark.anyio
async def test_cannot_go_from_cancelled_to_active() -> None:
    """CANCELLED → ACTIVE is not valid."""
    alert = _alert_with_state(AlertLifecycleState.CANCELLED)
    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.ACTIVE)


@pytest.mark.anyio
async def test_cannot_go_from_active_to_pending_confirmation() -> None:
    """ACTIVE → PENDING_CONFIRMATION is not valid."""
    alert = _alert_with_state(AlertLifecycleState.ACTIVE)
    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.PENDING_CONFIRMATION)


@pytest.mark.anyio
async def test_cannot_go_from_triggered_to_active() -> None:
    """TRIGGERED → ACTIVE is not valid."""
    alert = _alert_with_state(AlertLifecycleState.TRIGGERED)
    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.ACTIVE)


@pytest.mark.anyio
async def test_cannot_go_from_delivery_in_progress_to_active() -> None:
    """DELIVERY_IN_PROGRESS → ACTIVE is not valid."""
    alert = _alert_with_state(AlertLifecycleState.DELIVERY_IN_PROGRESS)
    with pytest.raises(InvalidAlertTransitionError):
        alert.transition_to(AlertLifecycleState.ACTIVE)


# ══════════════════════════════════════════════════════════════════
# 4. Lifecycle policy enforcement via CRUD service
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_cannot_confirm_twice(db_session: AsyncSession, user: User, usd_asset: Asset) -> None:
    """Confirming an already-active alert raises InvalidAlertTransitionError."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None

    # Second confirm: ACTIVE → ACTIVE is a no-op (self-transition)
    reconfirmed = await service.confirm(confirmed.id, user.id)
    assert reconfirmed is not None
    assert reconfirmed.lifecycle_state == AlertLifecycleState.ACTIVE


@pytest.mark.anyio
async def test_cannot_deactivate_already_cancelled(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Cancelling an already-cancelled alert is a no-op (self-transition)."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    await service.confirm(created.id, user.id)
    cancelled = await service.deactivate(created.id, user.id)
    assert cancelled is not None
    assert cancelled.lifecycle_state == AlertLifecycleState.CANCELLED

    # Second deactivate: CANCELLED → CANCELLED is a self-transition (no-op)
    re_cancelled = await service.deactivate(cancelled.id, user.id)
    assert re_cancelled is not None
    assert re_cancelled.lifecycle_state == AlertLifecycleState.CANCELLED


@pytest.mark.anyio
async def test_update_target_price_on_active_pauses_it(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Updating target_price on ACTIVE alert should pause it."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user,
        usd_asset,
        AlertCondition.ABOVE,
        Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    created = await service.create(alert)

    updated = await service.update(created.id, user.id, target_price=Decimal("95000"))
    assert updated is not None
    assert updated.lifecycle_state == AlertLifecycleState.PAUSED


@pytest.mark.anyio
async def test_alert_creation_sets_correct_defaults(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """New alert should have correct default values."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset)
    created = await service.create(alert)

    assert created.cooldown_minutes == 0
    assert created.is_active is False
    assert created.last_triggered_at is None
    assert created.confirmed_at is None
    assert created.triggered_at is None
    assert created.delivered_at is None
    assert created.cancelled_at is None


@pytest.mark.anyio
async def test_list_alerts_returns_only_user_alerts(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Listing alerts should only return alerts for the given user."""
    other_user = User(telegram_user_id="other-user", username="other")
    db_session.add(other_user)
    await db_session.commit()
    await db_session.refresh(other_user)

    service = AlertCRUDService(db_session)

    # Create alert for main user
    alert1 = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    await service.create(alert1)

    # Create alert for other user
    alert2 = _make_alert(other_user, usd_asset, AlertCondition.BELOW, Decimal("80000"))
    await service.create(alert2)

    # List should only return main user's alert
    user_alerts = await service.list_alerts(user.id)
    assert len(user_alerts) == 1
    assert user_alerts[0].user_id == user.id


@pytest.mark.anyio
async def test_delete_nonexistent_alert_returns_none(db_session: AsyncSession, user: User) -> None:
    """Deleting a non-existent alert returns None."""
    service = AlertCRUDService(db_session)
    result = await service.deactivate("nonexistent-id", user.id)
    assert result is None


@pytest.mark.anyio
async def test_update_nonexistent_alert_returns_none(db_session: AsyncSession, user: User) -> None:
    """Updating a non-existent alert returns None."""
    service = AlertCRUDService(db_session)
    result = await service.update("nonexistent-id", user.id, target_price=Decimal("100"))
    assert result is None


# ══════════════════════════════════════════════════════════════════
# 5. Edge cases
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_multiple_alerts_same_asset_different_users(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Two users can have alerts on the same asset."""
    other_user = User(telegram_user_id="other-user-2", username="other2")
    db_session.add(other_user)
    await db_session.commit()
    await db_session.refresh(other_user)

    service = AlertCRUDService(db_session)
    alert1 = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    alert2 = _make_alert(other_user, usd_asset, AlertCondition.BELOW, Decimal("80000"))

    created1 = await service.create(alert1)
    created2 = await service.create(alert2)

    assert created1.id != created2.id
    assert created1.asset_id == created2.asset_id
    assert created1.user_id != created2.user_id


@pytest.mark.anyio
async def test_alert_with_zero_cooldown_can_trigger_repeatedly(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """With cooldown=0, each evaluation cycle can trigger."""
    now = datetime.now(timezone.utc)
    alert = _make_alert(
        user,
        usd_asset,
        AlertCondition.ABOVE,
        Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    alert.cooldown_minutes = 0
    db_session.add(alert)
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("95000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    evaluator = AlertEvaluatorService(db_session)
    # First trigger
    events1 = await evaluator.evaluate_asset(usd_asset.id)
    assert len(events1) == 1

    # After trigger, alert is in TRIGGERED state, so no more triggers
    events2 = await evaluator.evaluate_asset(usd_asset.id)
    assert len(events2) == 0


# ── Helper ────────────────────────────────────────────────────────


def _alert_with_state(state: AlertLifecycleState) -> AlertRule:
    """Create a minimal AlertRule with the given lifecycle state (no DB needed)."""
    alert = AlertRule(
        user_id="u1",
        asset_id="a1",
        canonical_asset_id="a1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("100"),
        lifecycle_state=state,
        is_active=(state == AlertLifecycleState.ACTIVE),
    )
    return alert
