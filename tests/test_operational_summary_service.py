from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.application.services.operational_summary_service import (
    OperationalSummaryService,
)
from novax_price_alert.core.observability import metrics, record_metric
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.enums import AlertCondition, AlertEventStatus, AlertLifecycleState
from novax_price_alert.domain.latest_price import LatestPrice
from novax_price_alert.domain.provider import Provider
from novax_price_alert.domain.user import User


@pytest.mark.anyio
async def test_operational_summary_counts_runtime_state(db_session: AsyncSession) -> None:
    metrics.clear()
    record_metric("notification_send_failed_count", 2)
    observed_at = datetime(2026, 6, 4, 10, 0, tzinfo=timezone.utc)
    user = User(id="user-summary", telegram_user_id="123")
    asset = Asset(id="asset-summary", symbol="USD_IRT", name="US Dollar", unit="IRT")
    provider = Provider(id="provider-summary", slug="tgju_scrape", name="TGJU", priority=1)
    active_alert = AlertRule(
        id="alert-active",
        user_id=user.id,
        asset_id=asset.id,
        condition_type=AlertCondition.ABOVE,
        target_price=Decimal("1700000"),
        lifecycle_state=AlertLifecycleState.ACTIVE,
        is_active=True,
    )
    pending_alert = AlertRule(
        id="alert-pending",
        user_id=user.id,
        asset_id=asset.id,
        condition_type=AlertCondition.BELOW,
        target_price=Decimal("1600000"),
        lifecycle_state=AlertLifecycleState.PENDING_CONFIRMATION,
        is_active=False,
    )
    event = AlertEvent(
        alert_rule_id=active_alert.id,
        event_id="event-summary",
        idempotency_key="event-summary-key",
        triggered_price=Decimal("1710000"),
        triggered_at=observed_at,
        status=AlertEventStatus.FAILED,
    )
    fresh_price = LatestPrice(
        asset_id=asset.id,
        provider_id=provider.id,
        price=Decimal("1710000"),
        observed_at=observed_at,
        is_stale=False,
    )
    stale_asset = Asset(id="asset-summary-stale", symbol="EUR_IRT", name="Euro", unit="IRT")
    stale_price = LatestPrice(
        asset_id=stale_asset.id,
        provider_id=provider.id,
        price=Decimal("1850000"),
        observed_at=observed_at,
        is_stale=True,
    )
    db_session.add_all(
        [
            user,
            asset,
            stale_asset,
            provider,
            active_alert,
            pending_alert,
            event,
            fresh_price,
            stale_price,
        ]
    )
    await db_session.commit()

    summary = await OperationalSummaryService(db_session).summary()

    assert summary.metrics["notification_send_failed_count"] == 2
    assert summary.alerts_by_state[AlertLifecycleState.ACTIVE.value] == 1
    assert summary.alerts_by_state[AlertLifecycleState.PENDING_CONFIRMATION.value] == 1
    assert summary.events_by_status[AlertEventStatus.FAILED.value] == 1
    assert summary.latest_prices.total == 2
    assert summary.latest_prices.fresh == 1
    assert summary.latest_prices.stale == 1
    assert summary.latest_prices.oldest_observed_at is not None
    assert summary.latest_prices.newest_observed_at is not None
    assert summary.latest_prices.oldest_observed_at.replace(tzinfo=timezone.utc) == observed_at
    assert summary.latest_prices.newest_observed_at.replace(tzinfo=timezone.utc) == observed_at
