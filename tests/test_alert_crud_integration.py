"""Integration tests for alert CRUD, confirm, trigger, delete, and mini-app LIVE mode."""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.alert_crud_service import AlertCRUDService
from novax_price_alert.domain.alert_rule import AlertRule
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.enums import AlertCondition, AlertLifecycleState
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.user import User
from novax_price_alert.services.alert_evaluator import AlertEvaluatorService

# ── Fixtures ──────────────────────────────────────────────────────


@pytest.fixture
async def seeded_user(db_session: AsyncSession) -> User:
    user = User(telegram_user_id="12345", username="testuser", first_name="Test")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def seeded_asset(db_session: AsyncSession) -> Asset:
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
async def seeded_crypto_asset(db_session: AsyncSession) -> Asset:
    asset = Asset(
        symbol="BTC_USDT",
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


# ── Alert CRUD: Create ────────────────────────────────────────────


@pytest.mark.anyio
async def test_create_alert_lands_in_pending_confirmation(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    service = AlertCRUDService(db_session)
    alert = AlertRule(
        user_id=seeded_user.id,
        asset_id=seeded_asset.id,
        canonical_asset_id=seeded_asset.canonical_id,
        display_asset_name_at_creation=seeded_asset.display_name,
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
    )
    created = await service.create(alert)

    assert created.id is not None
    assert created.lifecycle_state == AlertLifecycleState.PENDING_CONFIRMATION
    assert created.is_active is False


@pytest.mark.anyio
async def test_create_alert_with_confirm_flag_transitions_to_active(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    service = AlertCRUDService(db_session)
    alert = AlertRule(
        user_id=seeded_user.id,
        asset_id=seeded_asset.id,
        canonical_asset_id=seeded_asset.canonical_id,
        display_asset_name_at_creation=seeded_asset.display_name,
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
    )
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, seeded_user.id)

    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert confirmed.is_active is True
    assert confirmed.confirmed_at is not None


# ── Alert CRUD: Confirm ───────────────────────────────────────────


@pytest.mark.anyio
async def test_confirm_alert_from_pending_to_active(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    service = AlertCRUDService(db_session)
    alert = AlertRule(
        user_id=seeded_user.id,
        asset_id=seeded_asset.id,
        canonical_asset_id=seeded_asset.canonical_id,
        display_asset_name_at_creation=seeded_asset.display_name,
        condition_type=AlertCondition.BELOW,
        target_price=Decimal("85000"),
        target_price_display_unit="IRT",
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )
    created = await service.create(alert)
    confirmed = await service.confirm(created.id, seeded_user.id)

    assert confirmed is not None
    assert confirmed.lifecycle_state == AlertLifecycleState.ACTIVE
    assert confirmed.is_active is True


@pytest.mark.anyio
async def test_confirm_nonexistent_alert_returns_none(
    db_session: AsyncSession, seeded_user: User
) -> None:
    service = AlertCRUDService(db_session)
    result = await service.confirm("nonexistent-id", seeded_user.id)
    assert result is None


@pytest.mark.anyio
async def test_confirm_wrong_user_returns_none(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    other_user = User(telegram_user_id="99999", username="other")
    db_session.add(other_user)
    await db_session.commit()
    await db_session.refresh(other_user)

    service = AlertCRUDService(db_session)
    alert = AlertRule(
        user_id=seeded_user.id,
        asset_id=seeded_asset.id,
        canonical_asset_id=seeded_asset.canonical_id,
        display_asset_name_at_creation=seeded_asset.display_name,
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
    )
    created = await service.create(alert)
    result = await service.confirm(created.id, other_user.id)
    assert result is None


# ── Alert CRUD: Trigger (via evaluator) ───────────────────────────


@pytest.mark.anyio
async def test_trigger_alert_when_price_above_target(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    observed_at = datetime.now(timezone.utc)
    db_session.add_all(
        [
            LatestPrice(
                asset_id=seeded_asset.id,
                provider_id="prov-1",
                price=Decimal("95000"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id=seeded_user.id,
                asset_id=seeded_asset.id,
                canonical_asset_id=seeded_asset.canonical_id,
                condition_type=AlertCondition.ABOVE,
                target_price=Decimal("91000"),
                cooldown_minutes=0,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(seeded_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == Decimal("95000")


@pytest.mark.anyio
async def test_trigger_alert_when_price_below_target(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    observed_at = datetime.now(timezone.utc)
    db_session.add_all(
        [
            LatestPrice(
                asset_id=seeded_asset.id,
                provider_id="prov-1",
                price=Decimal("80000"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id=seeded_user.id,
                asset_id=seeded_asset.id,
                canonical_asset_id=seeded_asset.canonical_id,
                condition_type=AlertCondition.BELOW,
                target_price=Decimal("85000"),
                cooldown_minutes=0,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(seeded_asset.id)
    assert len(events) == 1


@pytest.mark.anyio
async def test_no_trigger_when_price_not_met(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    observed_at = datetime.now(timezone.utc)
    db_session.add_all(
        [
            LatestPrice(
                asset_id=seeded_asset.id,
                provider_id="prov-1",
                price=Decimal("80000"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id=seeded_user.id,
                asset_id=seeded_asset.id,
                canonical_asset_id=seeded_asset.canonical_id,
                condition_type=AlertCondition.ABOVE,
                target_price=Decimal("91000"),
                cooldown_minutes=0,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(seeded_asset.id)
    assert events == []


@pytest.mark.anyio
async def test_trigger_transitions_alert_to_triggered_state(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    observed_at = datetime.now(timezone.utc)
    db_session.add_all(
        [
            LatestPrice(
                asset_id=seeded_asset.id,
                provider_id="prov-1",
                price=Decimal("95000"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id=seeded_user.id,
                asset_id=seeded_asset.id,
                canonical_asset_id=seeded_asset.canonical_id,
                condition_type=AlertCondition.ABOVE,
                target_price=Decimal("91000"),
                cooldown_minutes=0,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    await AlertEvaluatorService(db_session).evaluate_asset(seeded_asset.id)

    result = await db_session.execute(select(AlertRule).where(AlertRule.user_id == seeded_user.id))
    alert = result.scalar_one()
    assert alert.lifecycle_state == AlertLifecycleState.TRIGGERED


# ── Alert CRUD: Delete / Deactivate ──────────────────────────────


@pytest.mark.anyio
async def test_deactivate_alert_transitions_to_cancelled(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    service = AlertCRUDService(db_session)
    alert = AlertRule(
        user_id=seeded_user.id,
        asset_id=seeded_asset.id,
        canonical_asset_id=seeded_asset.canonical_id,
        display_asset_name_at_creation=seeded_asset.display_name,
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
    )
    created = await service.create(alert)
    cancelled = await service.deactivate(created.id, seeded_user.id)

    assert cancelled is not None
    assert cancelled.lifecycle_state == AlertLifecycleState.CANCELLED
    assert cancelled.is_active is False
    assert cancelled.cancelled_at is not None


@pytest.mark.anyio
async def test_deactivate_nonexistent_alert_returns_none(
    db_session: AsyncSession, seeded_user: User
) -> None:
    service = AlertCRUDService(db_session)
    result = await service.deactivate("nonexistent-id", seeded_user.id)
    assert result is None


# ── Mini-app LIVE mode: override-price + trigger ─────────────────


@pytest.mark.anyio
async def test_live_mode_override_price_triggers_alert(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    """Simulate the mini-app forcing a price above target, then the evaluator fires."""
    # Create an active alert
    alert = AlertRule(
        user_id=seeded_user.id,
        asset_id=seeded_asset.id,
        canonical_asset_id=seeded_asset.canonical_id,
        display_asset_name_at_creation=seeded_asset.display_name,
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("91000"),
        target_price_display_unit="IRT",
        cooldown_minutes=0,
        lifecycle_state=AlertLifecycleState.ACTIVE,
        is_active=True,
    )
    db_session.add(alert)
    await db_session.commit()

    # Simulate the override-price endpoint: inject a LatestPrice above target
    forced_price = Decimal("95000")
    now = datetime.now(timezone.utc)
    lp = LatestPrice(
        asset_id=seeded_asset.id,
        provider_id="studio-simulator",
        price=forced_price,
        observed_at=now,
        fetched_at=now,
        is_stale=False,
        raw_data={"source": "studio-simulator", "forced_by": "admin_override"},
    )
    db_session.add(lp)
    await db_session.commit()

    # Run evaluator — should trigger
    events = await AlertEvaluatorService(db_session).evaluate_asset(seeded_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == forced_price


# ── Cooldown prevents duplicate trigger ──────────────────────────


@pytest.mark.anyio
async def test_cooldown_prevents_immediate_retrigger(
    db_session: AsyncSession, seeded_user: User, seeded_asset: Asset
) -> None:
    observed_at = datetime.now(timezone.utc)
    db_session.add_all(
        [
            LatestPrice(
                asset_id=seeded_asset.id,
                provider_id="prov-1",
                price=Decimal("95000"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id=seeded_user.id,
                asset_id=seeded_asset.id,
                canonical_asset_id=seeded_asset.canonical_id,
                condition_type=AlertCondition.ABOVE,
                target_price=Decimal("91000"),
                cooldown_minutes=60,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    evaluator = AlertEvaluatorService(db_session)
    first = await evaluator.evaluate_asset(seeded_asset.id)
    assert len(first) == 1

    # Second evaluation within cooldown should not trigger
    second = await evaluator.evaluate_asset(seeded_asset.id)
    assert len(second) == 0


# ── Crypto asset trigger ──────────────────────────────────────────


@pytest.mark.anyio
async def test_trigger_crypto_alert_above_target(
    db_session: AsyncSession, seeded_user: User, seeded_crypto_asset: Asset
) -> None:
    observed_at = datetime.now(timezone.utc)
    db_session.add_all(
        [
            LatestPrice(
                asset_id=seeded_crypto_asset.id,
                provider_id="binance",
                price=Decimal("65000.50"),
                observed_at=observed_at,
            ),
            AlertRule(
                user_id=seeded_user.id,
                asset_id=seeded_crypto_asset.id,
                canonical_asset_id=seeded_crypto_asset.canonical_id,
                condition_type=AlertCondition.ABOVE,
                target_price=Decimal("60000"),
                cooldown_minutes=0,
                lifecycle_state=AlertLifecycleState.ACTIVE,
                is_active=True,
            ),
        ]
    )
    await db_session.commit()

    events = await AlertEvaluatorService(db_session).evaluate_asset(seeded_crypto_asset.id)
    assert len(events) == 1
    assert events[0].triggered_price == Decimal("65000.50")
