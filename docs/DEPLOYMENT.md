# Deployment

## Target Runtime

Deploy this project without Docker:

- Cloudflare Worker: Telegram relay for outbound Bot API calls
- VPS or local server process: FastAPI backend and background worker
- PostgreSQL in production, SQLite only for local smoke checks
- Redis-compatible cache/queue only if enabled by a future worker mode
- Nginx or Caddy for HTTPS in front of the FastAPI backend

The Python FastAPI app is not deployed directly to Cloudflare Workers. Cloudflare runs the lightweight relay in `deploy/cloudflare-worker/`, while the backend keeps the database, migrations, price fetcher, alert evaluator, and Telegram Mini App API.

## Cloudflare Telegram Relay

The relay exists to give the backend a stable HTTPS edge for Telegram sends.

Files:

- `deploy/cloudflare-worker/telegram-relay.js`
- `deploy/cloudflare-worker/wrangler.toml`
- `deploy/cloudflare-worker/package.json`

Required Cloudflare Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `RELAY_SECRET`

Backend environment variables after deploy:

```bash
TELEGRAM_RELAY_URL=https://novax-telegram-relay.<account>.workers.dev
TELEGRAM_RELAY_SECRET=<same value as RELAY_SECRET>
TELEGRAM_BOT_TOKEN=<bot token, still required by backend auth/config>
```

### Deploy Relay

Preferred non-interactive deploy from the project root:

```bash
export CLOUDFLARE_API_TOKEN=<workers edit token>
export TELEGRAM_BOT_TOKEN=<telegram bot token>
export TELEGRAM_RELAY_SECRET=<shared relay secret>
./scripts/deploy-cloudflare-relay.sh
curl -fsS https://novax-telegram-relay.<account>.workers.dev/health
```

Manual interactive deploy from `deploy/cloudflare-worker/`:

```bash
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put RELAY_SECRET
npx wrangler deploy
```

## Backend Setup

From the project root:

```bash
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m novax_price_alert.scripts.seed_mvp
```

Minimum production `.env` values:

```bash
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://price_alert:<password>@127.0.0.1:5432/price_alert
TELEGRAM_BOT_TOKEN=<telegram bot token>
TELEGRAM_RELAY_URL=https://novax-telegram-relay.<account>.workers.dev
TELEGRAM_RELAY_SECRET=<relay secret>
NERKH_API_KEY=<optional>
USE_MOCK_PROVIDER=false
USE_MOCK_NOTIFICATIONS=false
```

## Start Processes

API:

```bash
uv run uvicorn novax_price_alert.api.main:app --host 127.0.0.1 --port 8000
```

Worker:

```bash
uv run python -m novax_price_alert.worker_main
```

Use systemd, supervisor, or PM2 on the VPS to keep both processes running. Keep API and worker logs separate.

## Smoke Check

Local no-Docker smoke check:

```bash
./scripts/smoke-local.sh
```

The smoke script runs migrations, seeds MVP assets, fetches real prices through the provider chain, starts the API locally, checks `/health`, and verifies `/api/v1/prices/latest` returns provider slugs.

## Production Verification

After deploy:

```bash
curl -fsS https://<api-domain>/health
curl -fsS https://<api-domain>/api/v1/prices/latest
curl -fsS https://<cloudflare-worker-domain>/health
```

Expected API health response:

```json
{"status":"ok","db":"connected"}
```

Expected relay health response:

```json
{"status":"ok","service":"telegram-relay"}
```

## Safe Release Order

1. Deploy or verify Cloudflare relay.
2. Update backend `.env` with relay URL and shared secret.
3. Pull backend release on server.
4. Run `uv sync` if dependencies changed.
5. Run `uv run alembic upgrade head`.
6. Run `uv run python -m novax_price_alert.scripts.seed_mvp` if assets changed.
7. Restart API and worker processes.
8. Run health and latest-price checks.

## Backups

Before production migrations:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql
```

SQLite backups are acceptable only for local/dev use, not production.
