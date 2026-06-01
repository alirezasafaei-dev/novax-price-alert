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
npx wrangler secret put RELAY_SECRET
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
- Verify `TELEGRAM_RELAY_SECRET` matches in Worker secrets and backend `.env`.
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
