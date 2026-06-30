# Operations

## Production path

Production runs on Cloudflare Worker + D1 + Telegram Mini App.

- Worker code: `deploy/cloudflare-worker/src/`
- D1 schema: `deploy/cloudflare-worker/migrations/`
- Mini App assets: Worker route `/mini-app/`, backed by `ASSETS_KV`
- Telegram webhook: `/webhook` with `X-Telegram-Bot-Api-Secret-Token`

FastAPI/PostgreSQL/RQ/Render and KV-only alert storage are legacy/archive paths.

## Required runtime secrets and bindings

Secrets must be configured in Cloudflare/GitHub, never committed:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SECRET_TOKEN`
- `SETUP_SECRET`
- `OPS_CHAT_ID` (optional Worker ops alerts)
- `PAYMENT_INSTRUCTIONS` (if payment instructions are served)

Bindings:

- `DB` D1 database (`REQUIRE_D1=true` in production)
- `ASSETS_KV` for Mini App assets
- `SESSIONS_KV` for sessions/duplicate update state
- `USERS_KV` for user/profile cache
- `ALERTS_KV` only for legacy/local compatibility where explicitly allowed

## Cron and external heartbeat monitor

Cloudflare Cron runs every minute. The GitHub Actions workflow `.github/workflows/cron-heartbeat-monitor.yml` runs every 5 minutes and calls `deploy/monitoring/cron_heartbeat_monitor.sh`. It alerts Telegram ops only after cooldown/state checks.

Required GitHub repository secrets:

- `OPS_BOT_TOKEN`
- `OPS_CHAT_ID`

## KV namespace migration

If old production has `ALERTS_KV`, `SESSIONS_KV`, and `USERS_KV` pointing at the same namespace:

1. Run `deploy/cloudflare-worker/scripts/setup-kv.sh` or create separate namespaces for assets, sessions, and user/cache data and patch `wrangler.toml`.
2. Upload Mini App assets to `ASSETS_KV` using `deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh`.
3. Keep `ALERTS_KV` bound only long enough for local/legacy fallback and duplicate-send helpers.
4. Do not migrate production alerts from KV; D1 is canonical.

## Telegram token incident

Canonical status: **open until rotation and git-history cleanup are confirmed**. Redaction in current files is not enough. Rotate the token in BotFather, update Cloudflare/GitHub secrets, refresh webhook setup, and coordinate history cleanup before marking closed.
