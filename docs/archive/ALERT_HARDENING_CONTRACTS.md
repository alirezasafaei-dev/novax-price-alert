# Alert Hardening Contracts

This document freezes the runtime contracts for alert creation, evaluation, notification delivery, freshness, and observability.

## Asset identity

- `AlertRule.asset_id` is the canonical asset identifier used by backend logic.
- User-facing asset labels are snapshots, not identifiers. Alert creation stores `display_asset_name_at_creation` for auditability.
- `Asset.symbol`, `Asset.name`, and `Asset.display_name` are presentation/search values and must not replace the canonical ID in alert evaluation or delivery.

## Price presentation

- Prices are normalized with `normalize_price` before persistence or evaluation.
- The canonical numeric representation is `Decimal` quantized to 8 decimal places.
- User-facing output must include the display unit stored on the alert as `target_price_display_unit`.
- Alert creation snapshots the asset unit so later asset display changes do not rewrite the audit trail.

## Alert creation flow

Alert activation is staged:

1. Select an asset.
2. Select a condition: `above` or `below`.
3. Enter a positive target price.
4. Review the alert summary.
5. Explicitly confirm.
6. Only then transition to `active`.

The API creates alerts in `pending_confirmation` unless `confirm=true` is deliberately supplied for backward-compatible one-call clients. The explicit confirmation endpoint is `POST /alerts/{alert_id}/confirm`.

## Alert lifecycle

Supported lifecycle states are:

- `draft`
- `awaiting_condition`
- `awaiting_target_price`
- `pending_confirmation`
- `active`
- `triggered`
- `delivery_in_progress`
- `delivered`
- `paused`
- `cancelled`
- `failed`

Invalid transitions raise `InvalidAlertTransitionError`, emit an `invalid_transition_detected` structured log, and increment `invalid_transition_count` where services catch the transition.

## Trigger idempotency and concurrency

- A logical trigger event ID is `alert:{alert_rule_id}:observed:{observed_at}`.
- Notification idempotency key is `notification:{event_id}`.
- `alert_events.event_id` and `alert_events.idempotency_key` are unique.
- Evaluation commits each trigger event independently and treats uniqueness violations as duplicate triggers.
- Notification workers atomically claim pending/retryable events by changing status to `delivery_in_progress` with a `worker_run_id`; workers that fail the compare-and-set claim do not send.

## Retry policy

- Pending and failed events are retryable while `attempt_count < max_attempts`.
- Each claim increments `attempt_count`.
- Failed sends record `error_message` and `next_retry_at`.
- The default retry policy is 3 attempts with 60 seconds of backoff.
- Retries reuse the same `event_id` and `idempotency_key`.

## Freshness policy

Default price freshness thresholds:

- Expected update cadence: 5 minutes.
- Fresh threshold: 10 minutes.
- Stale threshold: 30 minutes.
- Unavailable threshold: 2 hours.

Evaluation is allowed only when the latest price is `fresh`. Stale or unavailable data blocks triggering and emits `stale_data_detected` with the classification and reason.

## Observability

Structured lifecycle logs include:

- `alert_created`
- `alert_updated`
- `alert_confirmed`
- `alert_activated`
- `alert_evaluated`
- `duplicate_trigger_detected`
- `duplicate_send_detected`
- `notification_send_started`
- `notification_send_succeeded`
- `notification_send_failed`
- `alert_cancelled`
- `invalid_transition_detected`
- `stale_data_detected`

Core in-process counters include alert creation, alert flow completion, alert evaluation, trigger count, duplicate trigger count, duplicate send count, stale evaluation count, unavailable evaluation count, notification send failures/successes, worker latency samples, queue backlog samples, and invalid transitions.

## Release checks

Before rollout, verify:

- Alert creation leaves alerts inactive until confirmation.
- Stale and unavailable prices do not trigger alerts.
- Send retries do not create a second event or a new idempotency key.
- Two workers cannot claim the same pending event.
- Lifecycle logs contain `alert_id`, `user_id` where available, `event_id`, and `worker_run_id` on worker paths.
