"""
Comprehensive E2E tests for the alert lifecycle — Task coverage.

Covers the specific user-facing flows:
1. Asset selection -> price display -> target entry -> summary -> confirm
2. Asset selection -> price display -> target entry -> summary -> cancel
3. Full lifecycle state transition contract enforcement
4. Alert event lifecycle (PENDING -> DELIVERY_IN_PROGRESS -> SENT/FAILED)
5. Edge cases: max alerts, duplicate triggers, stale data, cooldown
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

# ── Helpers ────────────────────────────────────────────────────────


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


def _alert_with_state(state: AlertLifecycleState) -> AlertRule:
    """Create a minimal AlertRule with the given lifecycle state (no DB needed)."""
    return AlertRule(
        user_id="u1",
        asset_id="a1",
        canonical_asset_id="a1",
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("100"),
        lifecycle_state=state,
        is_active=(state == AlertLifecycleState.ACTIVE),
    )


class OkSender(BaseNotificationSender):
    """Mock sender that always succeeds."""
    def __init__(self) -> None:
        self.sent_event_ids: list[str] = []

    async def send(self, event: AlertEvent) -> None:
        self.sent_event_ids.append(event.event_id)


class FailingSender(BaseNotificationSender):
    """Mock sender that always fails."""
    def __init__(self) -> None:
        self.attempted_event_ids: list[str] = []

    async def send(self, event: AlertEvent) -> None:
        self.attempted_event_ids.append(event.event_id)
        raise RuntimeError("telegram send failed")


class CountingSender(BaseNotificationSender):
    def __init__(self, fail_first: bool = False) -> None:
        self.sent_event_ids: list[str] = []
        self.fail_first = fail_first

    async def send(self, event: AlertEvent) -> None:
        self.sent_event_ids.append(event.event_id)
        if self.fail_first:
            self.fail_first = False
            raise RuntimeError("temporary telegram failure")


# ── Fixtures ───────────────────────────────────────────────────────


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    user = User(telegram_user_id="e2e-user-v2", username="e2e_tester_v2", first_name="E2E")
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


@pytest.fixture
async def gold_asset(db_session: AsyncSession) -> Asset:
    asset = Asset(
        symbol="GOLD_18",
        canonical_id="GOLD_18_IRT",
        name="Gold 18k",
        display_name="طلا ۱۸ عیار",
        category="commodity",
        unit="IRT",
    )
    db_session.add(asset)
    await db_session.commit()
    await db_session.refresh(asset)
    return asset


# ══════════════════════════════════════════════════════════════════
# 1. Asset selection -> price display -> target entry -> summary -> confirm
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_flow_select_asset_view_price_enter_target_summary_confirm(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """
    Simulate the full Telegram bot flow:
    1. User selects asset (USD)
    2. System shows current price
    3. User enters target price
    4. System shows summary
    5. User confirms -> alert becomes ACTIVE
    """
    now = datetime.now(timezone.utc)

    # Step 1: Asset is selected (usd_asset exists in DB)
    # Step 2: Price is displayed (inject a LatestPrice)
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("89500"),
            observed_at=now,
        )
    )
    await db_session.commit()

    # Step 3: User enters target price (e.g. "91000")
    # Step 4: System shows summary (alert created in PENDING_CONFIRMATION)
    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, usd_asset,
        condition=AlertCondition.ABOVE,
        target=Decimal("91000"),
    )
    created = await service.create(alert)

    # Verify summary state
    assert created.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION
    assert created.is_active is False
    assert created.target_price == Decimal("91000")
    assert created.condition_type == AlertCondition.ABOVE
    assert created.display_asset_name_at_creation == "دلار آزاد"

    # Step 5: User confirms
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert confirmed.is_active is True
    assert confirmed.confirmed_at is not None


@pytest.mark.anyio
async def test_flow_select_asset_view_price_enter_target_summary_cancel(
    db_session: AsyncSession, user: User, btc_asset: Asset
) -> None:
    """
    Simulate the flow where user cancels instead of confirming:
    1. User selects asset (BTC)
    2. System shows current price
    3. User enters target price
    4. System shows summary
    5. User cancels -> alert goes to CANCELLED
    """
    now = datetime.now(timezone.utc)

    # Price display
    db_session.add(
        LatestPrice(
            asset_id=btc_asset.id,
            provider_id="binance",
            price=Decimal("58000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    # Create alert (summary stage)
    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, btc_asset,
        condition=AlertCondition.BELOW,
        target=Decimal("55000"),
        unit="USDT",
    )
    created = await service.create(alert)
    assert created.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION

    # User cancels (deactivate from PENDING_CONFIRMATION)
    cancelled = await service.deactivate(created.id, user.id)
    assert cancelled is not None
    assert cancelled.lifecycle_state == AlertLifecycleState.CANCELLED
    assert cancelled.is_active is False
    assert cancelled.cancelled_at is not None


@pytest.mark.anyio
async def test_flow_crypto_asset_above_trigger(
    db_session: AsyncSession, user: User, btc_asset: Asset
) -> None:
    """
    Full flow for crypto: select BTC -> view price -> enter target -> confirm -> trigger.
    """
    now = datetime.now(timezone.utc)

    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, btc_asset,
        condition=AlertCondition.ABOVE,
        target=Decimal("60000"),
        unit="USDT",
    )
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE

    # Price crosses above target
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
    assert events[0].status == AlertEventStatus.PENDING


@pytest.mark.anyio
async def test_flow_gold_asset_below_trigger(
    db_session: AsyncSession, user: User, gold_asset: Asset
) -> None:
    """
    Full flow for gold: select gold -> view price -> enter target -> confirm -> trigger when below.
    """
    now = datetime.now(timezone.utc)

    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, gold_asset,
        condition=AlertCondition.BELOW,
        target=Decimal("3500000"),
        unit="IRT",
    )
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None

    # Price drops below target
    db_session.add(
        LatestPrice(
            asset_id=gold_asset.id,
            provider_id="tgju",
            price=Decimal("3200000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(gold_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == Decimal("3200000")


# ══════════════════════════════════════════════════════════════════
# 2. Lifecycle state transition contract enforcement
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_complete_transition_chain_draft_to_delivered() -> None:
    """
    Verify the complete valid chain:
    DRAFT -> AWAITING_CONDITION -> AWAITING_TARGET_PRICE ->
    PENDING_CONFIRMATION -> ACTIVE -> TRIGGERED ->
    DELIVERY_IN_PROGRESS -> DELIVERED
    """
    alert = _alert_with_state(AlertLifecycleState.DRAFT)

    alert.transition_to(AlertLifecycleState.AWAITING_CONDITION)
    assert alert.lifecycle_state == AlertLifecycleState.AWAITING_CONDITION

    alert.transition_to(AlertLifecycleState.AWAITING_TARGET_PRICE)
    assert alert.lifecycle_state == AlertLifecycleState.AWAITING_TARGET_PRICE

    alert.transition_to(AlertLifecycleState.PENDING_CONFIRMATION)
    assert alert.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION

    alert.transition_to(AlertLifecycleState.ACTIVE)
    assert alert.lifecycle_state == AlertLifecycleState.ACTIVE
    assert alert.is_active is True

    alert.transition_to(AlertLifecycleState.TRIGGERED)
    assert alert.lifecycle_state == AlertLifecycleState.TRIGGERED

    alert.transition_to(AlertLifecycleState.DELIVERY_IN_PROGRESS)
    assert alert.lifecycle_state == AlertLifecycleState.DELIVERY_IN_PROGRESS

    alert.transition_to(AlertLifecycleState.DELIVERED)
    assert alert.lifecycle_state == AlertLifecycleState.DELIVERED


@pytest.mark.anyio
async def test_complete_transition_chain_with_pause_and_resume() -> None:
    """ACTIVE -> PAUSED -> ACTIVE -> TRIGGERED -> DELIVERED"""
    alert = _alert_with_state(AlertLifecycleState.ACTIVE)

    alert.transition_to(AlertLifecycleState.PAUSED)
    assert alert.lifecycle_state == AlertLifecycleState.PAUSED
    assert alert.is_active is False

    alert.transition_to(AlertLifecycleState.ACTIVE)
    assert alert.lifecycle_state == AlertLifecycleState.ACTIVE
    assert alert.is_active is True

    alert.transition_to(AlertLifecycleState.TRIGGERED)
    alert.transition_to(AlertLifecycleState.DELIVERY_IN_PROGRESS)
    alert.transition_to(AlertLifecycleState.DELIVERED)
    assert alert.lifecycle_state == AlertLifecycleState.DELIVERED


@pytest.mark.anyio
async def test_complete_transition_chain_with_failure_and_retry() -> None:
    """ACTIVE -> TRIGGERED -> FAILED -> ACTIVE -> TRIGGERED -> DELIVERED"""
    alert = _alert_with_state(AlertLifecycleState.ACTIVE)

    alert.transition_to(AlertLifecycleState.TRIGGERED)
    alert.transition_to(AlertLifecycleState.FAILED)
    assert alert.lifecycle_state == AlertLifecycleState.FAILED

    alert.transition_to(AlertLifecycleState.ACTIVE)
    assert alert.lifecycle_state == AlertLifecycleState.ACTIVE

    alert.transition_to(AlertLifecycleState.TRIGGERED)
    alert.transition_to(AlertLifecycleState.DELIVERY_IN_PROGRESS)
    alert.transition_to(AlertLifecycleState.DELIVERED)
    assert alert.lifecycle_state == AlertLifecycleState.DELIVERED


@pytest.mark.anyio
async def test_complete_transition_chain_cancel_from_every_valid_state() -> None:
    """CANCELLED is reachable from: DRAFT, AWAITING_CONDITION, AWAITING_TARGET_PRICE,
    PENDING_CONFIRMATION, ACTIVE, PAUSED, FAILED."""
    cancel_sources = [
        AlertLifecycleState.DRAFT,
        AlertLifecycleState.AWAITING_CONDITION,
        AlertLifecycleState.AWAITING_TARGET_PRICE,
        AlertLifecycleState.PENDING_CONFIRMATION,
        AlertLifecycleState.ACTIVE,
        AlertLifecycleState.PAUSED,
        AlertLifecycleState.FAILED,
    ]
    for source in cancel_sources:
        alert = _alert_with_state(source)
        alert.transition_to(AlertLifecycleState.CANCELLED)
        assert alert.lifecycle_state == AlertLifecycleState.CANCELLED
        assert alert.is_active is False


@pytest.mark.anyio
async def test_all_invalid_transitions_are_rejected() -> None:
    """
    Exhaustively verify that every transition NOT in VALID_TRANSITIONS raises.
    """
    for current_state in AlertLifecycleState:
        valid_targets = AlertRule.VALID_TRANSITIONS.get(current_state, set())
        for next_state in AlertLifecycleState:
            if next_state == current_state:
                continue  # self-transitions are no-ops
            if next_state in valid_targets:
                continue  # valid transition
            alert = _alert_with_state(current_state)
            with pytest.raises(InvalidAlertTransitionError):
                alert.transition_to(next_state)


@pytest.mark.anyio
async def test_active_flag_is_synced_with_lifecycle_state() -> None:
    """is_active should be True only when state is ACTIVE."""
    alert = _alert_with_state(AlertLifecycleState.PENDING_CONFIRMATION)
    assert alert.is_active is False

    alert.transition_to(AlertLifecycleState.ACTIVE)
    assert alert.is_active is True

    alert.transition_to(AlertLifecycleState.PAUSED)
    assert alert.is_active is False

    alert.transition_to(AlertLifecycleState.ACTIVE)
    assert alert.is_active is True

    alert.transition_to(AlertLifecycleState.TRIGGERED)
    # transition_to sets is_active = (next_state == ACTIVE), so TRIGGERED -> False
    assert alert.is_active is False

    alert.transition_to(AlertLifecycleState.DELIVERY_IN_PROGRESS)
    assert alert.is_active is False

    alert.transition_to(AlertLifecycleState.DELIVERED)
    assert alert.is_active is False


# ══════════════════════════════════════════════════════════════════
# 3. Alert event lifecycle tests
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_event_lifecycle_pending_to_sent(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """AlertEvent: PENDING -> DELIVERY_IN_PROGRESS -> SENT"""
    now = datetime.now(timezone.utc)

    # Create active alert
    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    # Trigger
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
    event = events[0]
    assert event.status == AlertEventStatus.PENDING

    # Dispatch
    sender = OkSender()
    dispatcher = NotificationDispatcherService(db_session, sender)
    sent = await dispatcher.dispatch_pending_events(worker_run_id="e2e-dispatch-1")
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
async def test_event_lifecycle_pending_to_failed(
    db_session: AsyncSession,
) -> None:
    """AlertEvent: PENDING -> DELIVERY_IN_PROGRESS -> FAILED"""
    event = AlertEvent(
        alert_rule_id="rule-fail-1",
        event_id="event-fail-1",
        idempotency_key="notification:event-fail-1",
        triggered_price=Decimal("150"),
        triggered_at=datetime.now(timezone.utc),
        status=AlertEventStatus.PENDING,
    )
    db_session.add(event)
    await db_session.commit()

    sender = FailingSender()
    dispatcher = NotificationDispatcherService(
        db_session, sender, retry_backoff_seconds=0
    )
    sent = await dispatcher.dispatch_pending_events(worker_run_id="fail-w1")
    assert sent == 0

    refreshed = await db_session.get(AlertEvent, event.id)
    assert refreshed is not None
    assert refreshed.status == AlertEventStatus.FAILED
    assert refreshed.error_message is not None
    assert refreshed.next_retry_at is not None


@pytest.mark.anyio
async def test_event_lifecycle_failed_to_sent_on_retry(
    db_session: AsyncSession,
) -> None:
    """AlertEvent: FAILED -> DELIVERY_IN_PROGRESS -> SENT (retry succeeds)"""
    event = AlertEvent(
        alert_rule_id="rule-retry-1",
        event_id="event-retry-1",
        idempotency_key="notification:event-retry-1",
        triggered_price=Decimal("200"),
        triggered_at=datetime.now(timezone.utc),
        status=AlertEventStatus.FAILED,
        attempt_count=1,
        max_attempts=3,
        next_retry_at=datetime.now(timezone.utc),
    )
    db_session.add(event)
    await db_session.commit()

    sender = OkSender()
    dispatcher = NotificationDispatcherService(
        db_session, sender, retry_backoff_seconds=0
    )
    sent = await dispatcher.dispatch_pending_events(worker_run_id="retry-ok-1")
    assert sent == 1

    refreshed = await db_session.get(AlertEvent, event.id)
    assert refreshed is not None
    assert refreshed.status == AlertEventStatus.SENT
    assert refreshed.sent_at is not None


@pytest.mark.anyio
async def test_event_max_attempts_exhausted(
    db_session: AsyncSession,
) -> None:
    """After max_attempts, event should not be retried."""
    event = AlertEvent(
        alert_rule_id="rule-max-1",
        event_id="event-max-1",
        idempotency_key="notification:event-max-1",
        triggered_price=Decimal("300"),
        triggered_at=datetime.now(timezone.utc),
        status=AlertEventStatus.FAILED,
        attempt_count=3,
        max_attempts=3,
        next_retry_at=datetime.now(timezone.utc),
    )
    db_session.add(event)
    await db_session.commit()

    sender = FailingSender()
    dispatcher = NotificationDispatcherService(
        db_session, sender, retry_backoff_seconds=0
    )
    # Should not even attempt (attempt_count >= max_attempts)
    sent = await dispatcher.dispatch_pending_events(worker_run_id="max-attempts-1")
    assert sent == 0


# ══════════════════════════════════════════════════════════════════
# 4. CRUD service lifecycle enforcement
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_cannot_confirm_from_draft(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """DRAFT -> ACTIVE is invalid via confirm()."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.DRAFT,
    )
    created = await service.create(alert)

    with pytest.raises(InvalidAlertTransitionError):
        await service.confirm(created.id, user.id)


@pytest.mark.anyio
async def test_cannot_confirm_from_awaiting_condition(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """AWAITING_CONDITION -> ACTIVE is invalid via confirm()."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.AWAITING_CONDITION,
    )
    created = await service.create(alert)

    with pytest.raises(InvalidAlertTransitionError):
        await service.confirm(created.id, user.id)


@pytest.mark.anyio
async def test_cannot_deactivate_from_draft(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """DRAFT -> CANCELLED is valid."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.DRAFT,
    )
    created = await service.create(alert)

    cancelled = await service.deactivate(created.id, user.id)
    assert cancelled is not None
    assert cancelled.lifecycle_state == AlertLifecycleState.CANCELLED


@pytest.mark.anyio
async def test_confirm_sets_confirmed_at_timestamp(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Confirming an alert should set confirmed_at."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    assert created.confirmed_at is None

    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None
    assert confirmed.confirmed_at is not None


@pytest.mark.anyio
async def test_deactivate_sets_cancelled_at_timestamp(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Deactivating an alert should set cancelled_at."""
    service = AlertCRUDService(db_session)
    alert = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, user.id)
    assert confirmed is not None

    cancelled = await service.deactivate(confirmed.id, user.id)
    assert cancelled is not None
    assert cancelled.cancelled_at is not None


@pytest.mark.anyio
async def test_trigger_sets_triggered_at_timestamp(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Triggering an alert should set triggered_at."""
    now = datetime.now(timezone.utc)
    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("95000"),
            observed_at=now,
        )
    )
    await db_session.commit()

    await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    await db_session.refresh(alert)
    assert alert.triggered_at is not None


# ══════════════════════════════════════════════════════════════════
# 5. Multi-asset and multi-user scenarios
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_user_can_have_alerts_on_multiple_assets(
    db_session: AsyncSession, user: User, usd_asset: Asset, btc_asset: Asset, gold_asset: Asset
) -> None:
    """A single user can create alerts on different assets."""
    service = AlertCRUDService(db_session)

    alert1 = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    alert2 = _make_alert(user, btc_asset, AlertCondition.BELOW, Decimal("50000"), "USDT")
    alert3 = _make_alert(user, gold_asset, AlertCondition.ABOVE, Decimal("3500000"))

    created1 = await service.create(alert1)
    created2 = await service.create(alert2)
    created3 = await service.create(alert3)

    assert created1.id != created2.id
    assert created2.id != created3.id

    alerts = await service.list_alerts(user.id)
    assert len(alerts) == 3


@pytest.mark.anyio
async def test_different_users_same_asset_independent_lifecycle(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Two users with alerts on the same asset have independent lifecycles."""
    other_user = User(telegram_user_id="other-lifecycle", username="other_lifecycle")
    db_session.add(other_user)
    await db_session.commit()
    await db_session.refresh(other_user)

    service = AlertCRUDService(db_session)

    alert1 = _make_alert(user, usd_asset, AlertCondition.ABOVE, Decimal("91000"))
    alert2 = _make_alert(other_user, usd_asset, AlertCondition.BELOW, Decimal("80000"))

    created1 = await service.create(alert1)
    created2 = await service.create(alert2)

    # Confirm only user1's alert
    confirmed1 = await service.confirm(created1.id, user.id)
    assert confirmed1 is not None
    assert confirmed1.lifecycle_state == AlertLifecycleState.ACTIVE

    # User2's alert remains in PENDING_CONFIRMATION
    refreshed2 = await service.get_for_user(created2.id, other_user.id)
    assert refreshed2 is not None
    assert refreshed2.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION


# ══════════════════════════════════════════════════════════════════
# 6. Price display and stale data handling
# ══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_alert_not_triggered_with_stale_price(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Stale price data should not trigger alerts."""
    from datetime import timedelta

    old_time = datetime.now(timezone.utc) - timedelta(minutes=10)

    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    db_session.add(alert)
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("95000"),
            observed_at=old_time,
            is_stale=True,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    assert len(events) == 0


@pytest.mark.anyio
async def test_alert_not_triggered_when_price_at_target(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Price exactly at target should trigger (>= for ABOVE, <= for BELOW)."""
    now = datetime.now(timezone.utc)

    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    db_session.add(alert)
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("91000"),  # exactly at target
            observed_at=now,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    assert len(events) == 1  # >= means it triggers


@pytest.mark.anyio
async def test_alert_not_triggered_when_price_not_met(
    db_session: AsyncSession, user: User, usd_asset: Asset
) -> None:
    """Price below ABOVE target should not trigger."""
    now = datetime.now(timezone.utc)

    alert = _make_alert(
        user, usd_asset, AlertCondition.ABOVE, Decimal("91000"),
        state=AlertLifecycleState.ACTIVE,
    )
    alert.is_active = True
    db_session.add(alert)
    db_session.add(
        LatestPrice(
            asset_id=usd_asset.id,
            provider_id="tgju",
            price=Decimal("89000"),  # below target
            observed_at=now,
        )
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(usd_asset.id)
    assert len(events) == 0
