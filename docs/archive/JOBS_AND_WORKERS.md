# Jobs and Workers

## Why Workers Are Needed

Background workers keep the request path fast and stable.

They are needed because the system must perform tasks that are:

- periodic
- potentially slow
- retry-prone
- integration-dependent
- operationally separable from HTTP request handling

Examples:
- fetching provider prices
- evaluating alerts
- sending Bale messages

## Why RQ Is Chosen for MVP

RQ is selected because it is a strong fit for the current constraints:

- simple operational model
- Redis-backed
- low setup complexity
- enough for scheduled/async MVP jobs
- already aligned with the documented direction of `rubika-bot-saas`

## Worker Model

The runtime should include at least one worker process that consumes jobs from Redis.

Responsibilities:
- listen to queue(s)
- import known job functions
- execute jobs safely
- log failures clearly

Optional future queue split:
- `default`
- `prices`
- `notifications`

For MVP, one default queue is acceptable.

## Relationship to the Old Repository

### Confirmed from available evidence
The old repository explicitly states that background processing should use Redis and RQ.

### Not yet confirmed from code
- exact worker bootstrap structure
- actual queue naming strategy
- retry behavior
- job module organization

### Reuse Decision
Reuse the Redis + RQ operational model and likely the worker bootstrap shape once code-level verification is available.

## Job: `fetch_prices`

### Responsibility
Fetch current prices from provider integrations and persist both historical and latest state.

### Flow
1. load active providers
2. fetch raw data
3. normalize provider output
4. validate asset mapping
5. create `PriceSnapshot` records
6. upsert `LatestPrice`

### Failure Handling
- provider-specific failures should not corrupt existing latest prices
- invalid rows should be skipped safely
- failures should be logged with provider context

## Job: `evaluate_alerts`

### Responsibility
Evaluate active alert rules against latest prices.

### Flow
1. load active alerts
2. load latest price for each relevant asset
3. compare with target condition
4. enforce cooldown
5. create `AlertEvent`
6. update `last_triggered_at`
7. enqueue `send_notifications`

### Failure Handling
- evaluation failure for one alert should not stop processing all alerts
- missing latest price should result in skip, not crash
- event creation should be transactional where appropriate

## Job: `send_notifications`

### Responsibility
Deliver notification messages for triggered alert events.

### Flow
1. load alert event, alert rule, user, asset, price context
2. format message
3. call Bale client
4. create `NotificationDelivery`
5. update event status

### Failure Handling
- if Bale send fails, mark delivery as failed
- preserve error message in a safe, sanitized form
- do not silently lose failed sends

## Retries and Failure Handling

Recommended MVP policy:

- keep retries conservative
- retry only clearly transient failures
- avoid retry storms for malformed data
- log failures with job and entity context

Good retry candidates:
- temporary Bale network failure
- temporary provider timeout

Bad retry candidates:
- malformed webhook-derived state
- invalid asset mapping
- missing required domain entities due to logic bugs

## Idempotency Concerns

### Price Fetch
Repeated fetch jobs may produce duplicate snapshots if not controlled.  
This is acceptable for history if timestamps differ, but latest price upsert must be deterministic.

### Alert Evaluation
A poorly controlled evaluation loop can create duplicate alert events.  
Use cooldown and careful transaction boundaries to reduce duplicate firing.

### Notification Send
Notification sending should avoid duplicate messages where possible.  
At minimum, delivery records must allow post-incident tracing.

## Observability Notes

Workers should log:

- job start/end
- duration
- provider result counts
- alert evaluation counts
- notification success/failure counts
- exception summaries

## Scheduling Options for MVP

Possible approaches:

- simple cron calling enqueue scripts
- lightweight scheduler container
- application management command triggering jobs

Recommended MVP approach:
- keep scheduling simple and explicit
- do not add heavy orchestration unless needed
## Post-hardening Alert Job Contract

### `evaluate_alerts`

The evaluator must only load alerts that are active by lifecycle state. It must skip stale or missing latest prices and emit `stale_data_detected` instead of creating an alert event. For each evaluated alert, emit `alert_evaluated` with the alert id, canonical asset id, freshness status, and condition result.

A matching alert should create or claim a deterministic trigger event/idempotency key. If an equivalent trigger already exists, emit `duplicate_trigger_detected` and do not enqueue another notification.

### `send_notifications`

The dispatcher must atomically claim the event before sending, emit `notification_send_started`, and finalize exactly one successful send with `notification_send_succeeded`. If an event was already sent/finalized, emit `duplicate_send_detected` and do not send again. On failure, emit `notification_send_failed` with sanitized error context and leave enough state for operator review.

### Cloudflare Worker cron

The production Telegram Worker cron follows the same operational contract in KV: it evaluates only `lifecycle_state=active` alerts, skips unavailable provider batches, claims matching alerts before sending, stores `trigger_event_id`, finalizes successful sends as `lifecycle_state=delivered` and `enabled=false`, and ignores delivered alerts in later cron runs.
