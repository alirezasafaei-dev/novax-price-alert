# Alert Observability Runbook

## Purpose

This runbook defines the minimum log events and operational questions required before and during the post-hardening rollout. It applies to both backend alert workers and the Cloudflare Telegram Worker, with the Worker currently serving as the production bot alert source of truth.

## Required lifecycle events

Operators should be able to search logs by `alert_id` and, when present, `worker_run_id` or `event_id`.

| Event | Meaning | Operator action |
|---|---|---|
| `alert_activated` | A pending alert was explicitly confirmed and became active. | Confirm it happens only after user confirmation. |
| `alert_evaluated` | An active alert was compared with a fresh price. | Check `condition_matched`, `price`, and `freshness`. |
| `stale_data_detected` | Evaluation skipped because provider batch or asset price was unavailable/stale. | Verify no notification was sent for that alert/run. |
| `duplicate_trigger_detected` | A trigger claim was already taken or alert was no longer claimable. | Treat as a concurrency/idempotency signal; investigate if repeated. |
| `duplicate_send_detected` | The same deterministic notification event was already marked sent. | Stop rollout if a real duplicate message reached users. |
| `notification_send_started` | Dispatcher/cron started sending a notification. | Pair with success/failure for the same `event_id`. |
| `notification_send_succeeded` | Notification send succeeded and finalization should follow. | Verify alert becomes `delivered`/disabled. |
| `notification_send_failed` | Notification send failed. | Check provider/runtime/network error and whether alert moved to failed safely. |
| `alert_evaluation_job_completed` | Evaluation job completed with checked/triggered counts. | Use for cron health and anomaly detection. |

## Cloudflare Worker log tail

Run from `deploy/cloudflare-worker/`:

```bash
npx wrangler tail
```

Suggested filters/search terms during rollout:

```text
alert_activated
alert_evaluated
stale_data_detected
duplicate_trigger_detected
duplicate_send_detected
notification_send_started
notification_send_succeeded
notification_send_failed
alert_evaluation_job_completed
```

## Minimum event fields

For each alert lifecycle trace, collect as many of these fields as the runtime emits:

- `alert_id`
- `user_id` or `chat_id`
- `canonical_asset_id`
- `worker_run_id`
- `event_id` / `trigger_event_id`
- `lifecycle_state`
- `freshness` and `reason`
- `condition_matched`
- `error_message` for failures

## Operational gates

- Any real duplicate notification is a rollout stop.
- Any activation without user confirmation is a rollout stop.
- `stale_data_detected` is acceptable only when no notification follows for the same alert/run.
- A sustained absence of `alert_evaluation_job_completed` means cron may not be running.
- A spike in `notification_send_failed` pauses rollout until Telegram/network/runtime health is understood.

## Daily operator check

1. Tail logs for one cron window and verify `alert_evaluation_job_completed` appears.
2. Sample one active alert and trace `alert_evaluated` fields.
3. Review failures: `notification_send_failed`, provider errors, and `stale_data_detected` volume.
4. Confirm no `duplicate_send_detected` occurred for production users.
5. Inspect a delivered alert in KV/DB and verify it is disabled/finalized.
