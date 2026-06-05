import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.core.observability import emit_event, latency_timer, record_metric
from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule, InvalidAlertTransitionError
from novax_price_alert.domain.enums import AlertEventStatus, AlertLifecycleState
from novax_price_alert.infra.notifications.base import BaseNotificationSender


class NotificationDispatcherService:
    def __init__(
        self,
        session: AsyncSession,
        sender: BaseNotificationSender,
        *,
        max_attempts: int = 3,
        retry_backoff_seconds: int = 60,
    ) -> None:
        """
        Retry policy (T-206):
        - Only retry on FAILED status, under max_attempts.
        - Backoff: fixed retry_backoff_seconds.
        - Send notification retries protected by idempotency (claim + unique key).
        - No retry on terminal states.
        - After max: mark FAILED on rule, no more retry.
        """
        self.session = session
        self.sender = sender
        self.max_attempts = max_attempts
        self.retry_backoff_seconds = retry_backoff_seconds

    async def dispatch_pending_events(self, worker_run_id: str | None = None) -> int:
        run_id = worker_run_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        stmt = select(AlertEvent).where(
            AlertEvent.status.in_([AlertEventStatus.PENDING, AlertEventStatus.FAILED]),
            AlertEvent.attempt_count < AlertEvent.max_attempts,
            or_(AlertEvent.next_retry_at.is_(None), AlertEvent.next_retry_at <= now),
        )
        result = await self.session.execute(stmt)
        events = result.scalars().all()
        record_metric("queue_backlog", len(events))

        sent_count = 0

        for event in events:
            claimed = await self._claim_event(event.id, run_id)
            if claimed is None:
                record_metric("duplicate_send_count")
                emit_event(
                    "duplicate_send_detected",
                    event_id=event.event_id,
                    alert_id=event.alert_rule_id,
                    worker_run_id=run_id,
                )
                continue

            with latency_timer(
                "worker_processing_latency_count",
                {"worker_run_id": run_id, "event_id": claimed.event_id},
            ):
                emit_event(
                    "notification_send_started",
                    event_id=claimed.event_id,
                    alert_id=claimed.alert_rule_id,
                    worker_run_id=run_id,
                    attempt_count=claimed.attempt_count,
                )
                try:
                    await self.sender.send(claimed)
                    await self._mark_sent(claimed, run_id)
                    sent_count += 1
                except Exception as exc:
                    await self._mark_failed(claimed, exc, run_id)

        return sent_count

    async def _claim_event(self, event_id: str, worker_run_id: str) -> AlertEvent | None:
        now = datetime.now(timezone.utc)
        stmt = (
            update(AlertEvent)
            .where(
                AlertEvent.id == event_id,
                AlertEvent.status.in_([AlertEventStatus.PENDING, AlertEventStatus.FAILED]),
                AlertEvent.attempt_count < AlertEvent.max_attempts,
                or_(AlertEvent.next_retry_at.is_(None), AlertEvent.next_retry_at <= now),
            )
            .values(
                status=AlertEventStatus.DELIVERY_IN_PROGRESS,
                claimed_at=now,
                worker_run_id=worker_run_id,
                attempt_count=AlertEvent.attempt_count + 1,
                error_message=None,
            )
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        if getattr(result, "rowcount", 0) != 1:
            return None

        refreshed = await self.session.get(AlertEvent, event_id)
        if refreshed is None:
            return None

        rule = await self.session.get(AlertRule, refreshed.alert_rule_id)
        if rule is not None:
            try:
                rule.transition_to(AlertLifecycleState.DELIVERY_IN_PROGRESS)
                await self.session.commit()
            except InvalidAlertTransitionError:
                await self.session.rollback()
                record_metric("invalid_transition_count")
                emit_event(
                    "invalid_transition_detected",
                    alert_id=rule.id,
                    user_id=rule.user_id,
                    event_id=refreshed.event_id,
                    worker_run_id=worker_run_id,
                    from_state=str(rule.lifecycle_state),
                    to_state=AlertLifecycleState.DELIVERY_IN_PROGRESS.value,
                )
        return refreshed

    async def _mark_sent(self, event: AlertEvent, worker_run_id: str) -> None:
        now = datetime.now(timezone.utc)
        event.status = AlertEventStatus.SENT
        event.sent_at = now
        event.error_message = None
        event.next_retry_at = None

        rule = await self.session.get(AlertRule, event.alert_rule_id)
        if rule is not None:
            try:
                rule.transition_to(AlertLifecycleState.DELIVERED)
                rule.delivered_at = now
            except InvalidAlertTransitionError:
                record_metric("invalid_transition_count")
                emit_event(
                    "invalid_transition_detected",
                    alert_id=rule.id,
                    user_id=rule.user_id,
                    event_id=event.event_id,
                    worker_run_id=worker_run_id,
                    from_state=str(rule.lifecycle_state),
                    to_state=AlertLifecycleState.DELIVERED.value,
                )

        await self.session.commit()
        record_metric("notification_send_succeeded_count")
        emit_event(
            "notification_send_succeeded",
            event_id=event.event_id,
            alert_id=event.alert_rule_id,
            worker_run_id=worker_run_id,
            sent_at=now.isoformat(),
        )

    async def _mark_failed(self, event: AlertEvent, exc: Exception, worker_run_id: str) -> None:
        event.status = AlertEventStatus.FAILED
        event.error_message = str(exc)[:500]
        event.next_retry_at = datetime.now(timezone.utc) + timedelta(
            seconds=self.retry_backoff_seconds,
        )
        if event.attempt_count >= self.max_attempts:
            rule = await self.session.get(AlertRule, event.alert_rule_id)
            if rule is not None:
                try:
                    rule.transition_to(AlertLifecycleState.FAILED)
                except InvalidAlertTransitionError:
                    record_metric("invalid_transition_count")

        await self.session.commit()
        record_metric("notification_send_failed_count")
        emit_event(
            "notification_send_failed",
            event_id=event.event_id,
            alert_id=event.alert_rule_id,
            worker_run_id=worker_run_id,
            attempt_count=event.attempt_count,
            max_attempts=event.max_attempts,
            error_message=event.error_message,
        )
