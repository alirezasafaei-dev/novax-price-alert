# Operations

## Production paths

### مسیر اصلی: Cloudflare Worker + D1

- Worker code: `deploy/cloudflare-worker/src/`
- D1 schema: `deploy/cloudflare-worker/migrations/`
- Mini App assets: Worker route `/mini-app/`, backed by `ASSETS_KV`
- Telegram webhook: `/webhook` with `X-Telegram-Bot-Api-Secret-Token`
- Cron schedule: هر ۱ ساعت (`0 * * * *`) برای کاهش مصرف رایگان Workers.
- Heartbeat monitor (GitHub Actions): هر ۵ دقیقه `/status` Worker را چک می‌کند.

### مسیر جایگزین: VPS مستقل (PM2 + Nginx, بدون Docker)

- Setup: `scripts/setup-vps.sh` (اجرا به صورت root روی VPS)
- شامل: PostgreSQL, Redis, FastAPI, Worker, Nginx (همه system package)
- Process manager: PM2 (`ecosystem.config.js`)
- Nginx config: `nginx.vps.conf` (upstream به FastAPI روی 127.0.0.1:8000)
- Worker loop: هر ۳۶۰۰ ثانیه (قابل تنظیم با `WORKER_INTERVAL_SECONDS`)
- Mini App assets توسط FastAPI در `/mini-app/` سرو می‌شود
- Telegram webhook به API خود VPS تنظیم می‌شود
- دیپلوی بروزرسانی: `scripts/deploy-vps-only.sh` (rsync + uv sync + pm2 restart)

مستندات کامل: `docs/VPS_DEPLOYMENT.md`

## Required runtime secrets and bindings

Secrets must be configured in Cloudflare/GitHub, never committed:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SECRET_TOKEN`
- `SETUP_SECRET`
- `OPS_CHAT_ID` (optional Worker ops alerts)
- `PAYMENT_INSTRUCTIONS` (if payment instructions are served)
- `BOT_USERNAME` (Telegram bot username without @, required for referral links and marketing deep links)

Bindigs:

- `DB` D1 database (`REQUIRE_D1=true` in production)
- `ASSETS_KV` for Mini App assets
- `SESSIONS_KV` for sessions/duplicate update state
- `USERS_KV` for user/profile cache
- `ALERTS_KV` only for legacy/local compatibility where explicitly allowed

### Growth / Marketing env vars (optional)

- `MARKETING_POSTING_ENABLED` — set to `"true"` to enable daily channel posts (default: `"false"`)
- `MARKETING_CHANNEL_ID` — Telegram channel ID (e.g. `-1001234567890`) for daily market posts
- `MARKETING_POST_HOUR_TEHRAN` — hour in Tehran timezone for posting (reserved, default behavior posts on first cron run of the day)

## Cron and external heartbeat monitor

Cloudflare Cron runs every hour (`0 * * * *`). The GitHub Actions workflow `.github/workflows/cron-heartbeat-monitor.yml` runs every 5 minutes and calls `deploy/monitoring/cron_heartbeat_monitor.sh`. It alerts Telegram ops only after cooldown/state checks. Cooldown (1800 ثانیه) از هشدارهای تکراری جلوگیری می‌کند.

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
