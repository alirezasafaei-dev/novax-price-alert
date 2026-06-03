# Operations

## Runtime Model

Operate two backend processes and one Cloudflare Worker:

- FastAPI API process
- price/alert background worker process
- Cloudflare Telegram relay Worker

Do not use Docker for this deployment path.

## Common Commands

Run from the project root.

### Install / Sync

```bash
uv sync
```

### Apply Migrations

```bash
uv run alembic upgrade head
```

### Seed MVP Assets

```bash
uv run python -m novax_price_alert.scripts.seed_mvp
```

### Start API

```bash
uv run uvicorn novax_price_alert.api.main:app --host 127.0.0.1 --port 8000
```

### Start Worker

```bash
uv run python -m novax_price_alert.worker_main
```

### Smoke Test

```bash
./scripts/smoke-local.sh
```

### Quality Checks

```bash
uv run ruff check .
uv run mypy src
uv run pytest
```

## Cloudflare Relay Operations

Run from `deploy/cloudflare-worker/`.

### Test Relay Locally

```bash
npm test
```

### Deploy Relay

Use the secret-safe deploy script when updating Worker code, secrets, and webhook together:

```bash
cd deploy/cloudflare-worker
bash scripts/deploy.sh
```

For one-off deploys using a temporary root `.env`, remove it automatically at script exit:

```bash
cd deploy/cloudflare-worker
DELETE_ENV_AFTER_DEPLOY=1 bash scripts/deploy.sh
```

If secrets and webhook are already configured, code-only deploy is still:

```bash
npx wrangler deploy
```

### Tail Relay Logs

```bash
npx wrangler tail
```

### Update Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_SECRET_TOKEN
```


## Current Telegram Production State

See `docs/TELEGRAM_RUNBOOK.md` for the live Telegram bot runbook.

Current verified public endpoints:

- Cloudflare Worker: `https://novax-telegram-relay.asdevelooper.workers.dev`
- Telegram webhook: `https://novax-telegram-relay.asdevelooper.workers.dev/webhook`

The live Worker is menu-driven. Slash commands are only `/start` and `/help`; everything else is via the reply keyboard (💰 قیمت‌ها / 🔔 تنظیم هشدار / 📋 هشدارهای من / ❓ راهنما).

Prices: crypto BTC/ETH/SOL/BNB from Binance in USDT; fiat (USD/EUR) and gold (18K/Emami) from TGJU in Toman. Times formatted in `Asia/Tehran`.

## Monitoring

Minimum checks:

- API `/health`
- API `/api/v1/prices/latest`
- Cloudflare relay `/health`
- worker process is running
- latest prices are not stale
- provider failures appear in logs

## Failure Modes

### Provider Outage

- Keep existing latest prices.
- Do not overwrite with empty or fabricated values.
- Inspect worker logs for provider failure order.
- Prefer adding a provider key before lowering reliability assumptions.

### Cloudflare Relay Failure

- API can still operate, but Telegram notifications may fail.
- Check Worker health and `wrangler tail`.
- Verify `TELEGRAM_SECRET_TOKEN` matches the Telegram webhook secret configured for the Worker.
- Verify `TELEGRAM_BOT_TOKEN` Worker secret is present.

### Database Failure

- `/health` should fail or return an error.
- Stop workers if writes are failing repeatedly.
- Restore from PostgreSQL backup if needed.

## Security Rules

- Never commit `.env` or secrets.
- Never print Telegram tokens or relay secrets in logs.
- Keep `RELAY_SECRET` enabled in production.
- Keep the backend bound to `127.0.0.1` behind a reverse proxy unless intentionally exposed.
- Use HTTPS for Telegram Mini App and relay URLs.

## Alert Hardening Rollout Operations

Use this section after deploying the hardened alert lifecycle and Telegram Worker flow.

### Required Pre-Rollout Checks

Run these checks before enabling or trusting production alert delivery:

```bash
uv run ruff check src tests
uv run mypy src
uv run pytest -q
cd deploy/cloudflare-worker && npm test
```

Apply backend migrations in the target environment:

```bash
uv run alembic upgrade head
```

Then create low-risk manual Telegram alerts in each supported market and verify:

- the alert is not active before explicit confirmation;
- the confirmation summary shows asset, condition, target price, unit, and current price when available;
- correction before confirmation works;
- delivered alerts are not sent again on the next cron run;
- unavailable or missing provider data produces `stale_data_detected` and does not trigger.

### Lifecycle Logs to Watch

During rollout, tail Cloudflare Worker logs and backend worker logs and look for:

- `alert_activated`
- `alert_evaluated`
- `stale_data_detected`
- `duplicate_trigger_detected`
- `duplicate_send_detected`
- `notification_send_started`
- `notification_send_succeeded`
- `notification_send_failed`
- `alert_evaluation_job_completed`

### Rollout Stop Conditions

Pause rollout immediately if any of the following occur:

- any duplicate user-visible notification;
- an alert activates without explicit confirmation;
- a missing/unavailable price triggers an alert;
- notification send failures spike across a cron cycle;
- lifecycle logs do not include enough identifiers to trace a fired alert.

### Next-Step Planning

The detailed post-hardening roadmap and task backlog are maintained in `docs/NEXT_STEPS_AND_ROADMAP_FA.md`.

## Post-hardening Alert Operations

The hardened alert contract is now the release baseline:

- Alert creation is staged. A newly created backend alert starts as `pending_confirmation` and the Telegram Worker keeps pending alert data in session state until the user confirms the summary.
- Activation requires explicit confirmation. Operators should treat any `active` alert without `confirmed_at` as suspicious.
- Asset identity is canonical. Use `asset_id` in backend records and `canonical_asset_id` (`market:symbol`) in Worker KV/logs; display labels are snapshots for user readability.
- Price units are explicit through `target_price_display_unit`; do not infer units from asset names.
- Stale, missing, or unavailable provider data must not trigger alerts. Look for `stale_data_detected` logs.
- Delivered one-shot alerts are finalized and disabled; later cron/evaluation runs must not re-send them.

For release gates and incident response, use `docs/RELEASE_READINESS_FA.md`. For log events and operator queries, use `docs/OBSERVABILITY.md`.

## Alert Rollout Commands

Backend validation from the repo root:

```bash
git diff --check
uv run ruff check src tests
uv run mypy src
uv run pytest -q
```

Worker validation:

```bash
cd deploy/cloudflare-worker
npm test
npx wrangler tail
```

## Alert Incident Shortcuts

### Duplicate notification

1. Stop rollout and disable cron or deploy the previous Worker.
2. Search logs for `duplicate_send_detected`, `duplicate_trigger_detected`, `notification_send_started`, and `notification_send_succeeded`.
3. Inspect the alert record for `trigger_event_id`, `triggered_at`, `delivered_at`, `enabled`, and `lifecycle_state`.
4. Keep the alert disabled until root cause is understood.

### Stale provider

1. Search logs for `stale_data_detected` and provider-specific errors.
2. Verify the same `alert_id` did not proceed to `notification_send_started` in that run.
3. Check Binance for crypto and TGJU mirrors for fiat/gold.
4. Do not lower freshness requirements during rollout unless explicitly approved.
