# Alert Observability Runbook

## Purpose

This runbook defines the minimum log events and operational questions required before and during the post-hardening rollout. It applies to both backend alert workers and the Cloudflare Telegram Worker.

## Log format

The Cloudflare Worker emits **one JSON object per log line** (see `deploy/cloudflare-worker/src/log.js`). Every record has a stable envelope:

```json
{ "event": "notification_send_failed", "level": "error", "ts": "2026-06-03T20:36:00.000Z", "alert_id": "...", "event_id": "...", "worker_run_id": "...", "error_message": "..." }
```

- `event`: snake_case event name (the values in the tables below).
- `level`: `info` | `warn` | `error`. Routed to `console.log` / `console.warn` / `console.error` respectively, so you can filter by stream as well as by field.
- `ts`: ISO-8601 timestamp.
- Remaining keys are event-specific fields.

Because the event name is a field (not a free-form string prefix), logs are queryable by field in `wrangler tail` and Cloudflare Logpush.

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
| `alert_cancelled` (info) | An alert was deleted/cancelled by the user. | Expected on user delete; investigate only if unexpected. |
| `alert_evaluation_job_completed` (info) | Evaluation job completed with checked/triggered counts. | Use for cron health and anomaly detection. |
| `cron_invocation_completed` (info) | The scheduled handler finished a run (checked/triggered). | Outer cron heartbeat; pairs with `alert_evaluation_job_completed`. |

Note on levels: `stale_data_detected` and `duplicate_*` are emitted at `info`/`warn`; `notification_send_failed` is emitted at `error`.

## Provider & runtime events

| Event | Level | Meaning | Operator action |
|---|---|---|---|
| `provider_fetch_retry` | warn | A price-provider fetch attempt failed and may be retried (`attempt`, `max_attempts`, `will_retry`, `retry_delay_ms`). | Occasional retries are normal; sustained volume signals a provider issue. |
| `provider_fetch_failed` | error | All retries for a provider (`crypto` or `iran_market`) were exhausted. | Provider outage — evaluation will classify that market as `unavailable`. |
| `alerts_list_price_load_failed` | error | Loading prices for the "my alerts" list failed. | UI degradation only; alerts list still renders without live prices. |
| `callback_handler_error` | error | An unhandled exception while handling a Telegram callback. | Inspect `error_message`/`stack`; user saw a generic retry message. |
| `callback_data_missing` | warn | A callback query arrived without `data`. | Usually benign/client noise; investigate if frequent. |

## Cloudflare Worker log tail

Run from `deploy/cloudflare-worker/`:

```bash
npx wrangler tail
```

Suggested filters/search terms during rollout:

```text
alert_activated
alert_cancelled
alert_evaluated
stale_data_detected
duplicate_trigger_detected
duplicate_send_detected
notification_send_started
notification_send_succeeded
notification_send_failed
alert_evaluation_job_completed
cron_invocation_completed
provider_fetch_retry
provider_fetch_failed
callback_handler_error
```

Since each line is JSON, you can also filter by level, e.g. only errors:

```bash
npx wrangler tail --format json | grep '"level":"error"'
```

## Runtime counters

The backend exposes a minimal `GET /metrics` JSON endpoint for in-process counters recorded through `record_metric()`. Treat it as a lightweight rollout signal for counts such as alert creation, alert confirmation, invalid transitions, and notification delivery. It is not a durable dashboard or time-series system; add those only as a later controlled expansion if the operational value is clear.

Set `METRICS_ACCESS_TOKEN` for deployment and send it with `X-Metrics-Token`. Production requests are rejected when a valid token is not configured and provided.

```bash
curl -s -H "X-Metrics-Token: $METRICS_ACCESS_TOKEN" https://api.example.com/metrics
```

## Cron heartbeat & external monitor

A stopped cron cannot be detected from inside the Worker (no run → no log). The
Worker therefore records a heartbeat and exposes it for an external checker. See
ADR `docs/adr/0002-cron-heartbeat-monitor-placement.md`.

- **Heartbeat:** at the end of every scheduled run the Worker writes
  `cron:last_run` to KV (`{ts, checked, triggered}`), via
  `recordCronHeartbeat()` in `deploy/cloudflare-worker/src/heartbeat.js`.
- **`GET /status`:** returns `status` (`ok` | `stale` | `unknown`),
  `age_seconds`, `last_cron_run`, `expected_interval_seconds` (600), and
  `stale_after_seconds`. Returns HTTP **`503`** when stale (default: > 3 missed
  ticks = 30 min) so even a dumb HTTP checker can alert on status code alone.

  ```bash
  curl -s https://novax-telegram-relay.asdevelooper.workers.dev/status
  # {"status":"ok","last_cron_run":"...","age_seconds":44,...}
  ```

- **External monitor:** `deploy/monitoring/cron_heartbeat_monitor.sh` polls
  `/status` and alerts the Telegram ops group if the Worker is unreachable or the
  heartbeat is stale. It runs on **GitHub Actions** every 15 minutes
  (`.github/workflows/cron-heartbeat-monitor.yml`). Required repo secrets:
  `OPS_BOT_TOKEN`, `OPS_CHAT_ID`.
- **Healthy = silent.** The monitor only messages on failure; a green run with no
  Telegram message is the normal healthy state. To get a visible end-to-end
  confirmation without a real outage, point it at an unreachable URL once, e.g.
  `WORKER_URL=http://127.0.0.1:9 COOLDOWN_SEC=0 ... cron_heartbeat_monitor.sh`.

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
- `level` and `ts` (present on every event)
- `error_message` (and `stack` for unhandled exceptions) for failures

## Operational gates

- Any real duplicate notification is a rollout stop.
- Any activation without user confirmation is a rollout stop.
- `stale_data_detected` is acceptable only when no notification follows for the same alert/run.
- A sustained absence of `alert_evaluation_job_completed` means cron may not be running.
- A spike in `notification_send_failed` pauses rollout until Telegram/network/runtime health is understood.

## When to use this runbook

- before rollout
- during rollout
- during incident triage
- when validating the logging contract against code changes

## Daily operator check

1. Tail logs for one cron window and verify `alert_evaluation_job_completed` appears.
2. Sample one active alert and trace `alert_evaluated` fields.
3. Review failures: `notification_send_failed`, provider errors, and `stale_data_detected` volume.
4. Confirm no `duplicate_send_detected` occurred for production users.
5. Inspect a delivered alert in KV/DB and verify it is disabled/finalized.
