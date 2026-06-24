# Telegram Alert Worker

This Cloudflare Worker is the current production Telegram bot runtime for price alerts. It handles:

- `GET /health`
- `GET /setup-webhook`
- `POST /webhook`
- `GET /api/v1/prices/latest`
- `GET/POST/PATCH/DELETE /api/v1/alerts*` for the standalone mini-app
- `GET /mini-app/` for the embedded Telegram WebApp build
- scheduled cron evaluation of alerts stored in `ALERTS_KV`

Required secrets/bindings:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SECRET_TOKEN`
- `ALERTS_KV`
- `SESSIONS_KV`
- `USERS_KV`

Optional runtime variables:

- `NOVAX_MINI_APP_URL` or `MINI_APP_URL`: enables the Telegram WebApp button in `/start`.
- `TELEGRAM_AUTH_MAX_AGE_SECONDS`: max age for Telegram WebApp `initData` auth. Defaults to `86400`.
- `MINI_APP_MANIFEST_CACHE_SECONDS`: static mini-app manifest cache TTL. Defaults to `60`; set `0` to disable during debugging.

## Current alert flow

The bot is menu-driven. Slash commands are limited to `/start` and `/help`; users create alerts through buttons:

```text
market → asset → condition → target → summary → confirm
```

Runtime rules:

- Pending alert data stays in `SESSIONS_KV` until the summary is confirmed.
- No alert is persisted to `ALERTS_KV` before confirmation.
- Users can edit the target price before confirmation.
- Users can cancel before activation; cancel clears the session and creates no alert.
- Persisted alerts include `canonical_asset_id`, `display_asset_name_at_creation`, `target_price_display_unit`, `lifecycle_state`, `confirmed_at`, `triggered_at`, `delivered_at`, and `trigger_event_id`.
- Cron evaluates only active alerts, skips unavailable/missing provider data, claims before sending, and finalizes successful one-shot alerts as delivered/disabled.
- Delivered alerts are not re-sent on later cron runs.

## Local test commands

Run from this directory:

```bash
npm test
```

Wrangler 4 currently runs in this repo with Node 20. Do not run `npm audit fix --force`
blindly here: npm may suggest a Wrangler downgrade or a latest Wrangler build that requires
Node 22. Upgrade the runtime first, then update Wrangler within a compatible major line.

To run the Worker under Wrangler during manual validation:

```bash
npx wrangler dev
```

## Deploy and operations

The deploy script is secret-safe: it loads `../../.env` when present, otherwise uses the current environment, validates all required secret variables before touching Cloudflare, uploads Worker secrets, deploys the Worker, sets the Telegram webhook, and prints only redacted verification output.

Required environment variables:

```bash
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_SECRET_TOKEN=...
```

Deploy from this directory:

```bash
bash scripts/deploy.sh
```

For the full Worker-hosted mini-app path (recommended production path when Pages upload is unstable), run from the repo root. The script builds the mini-app, syncs KV assets idempotently with `sha256` checksums, uploads Worker secrets, deploys, configures Telegram, and verifies production endpoints:

```bash
deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh
```

If a temporary `.env` file was created only for this deploy, ask the script to remove it at exit:

```bash
DELETE_ENV_AFTER_DEPLOY=1 bash scripts/deploy.sh
```

If secrets and webhook are already configured and you only need to upload code, you can still run:

```bash
npx wrangler deploy
```

Tail production/staging logs:

```bash
npx wrangler tail
```

The deploy script verifies health and Telegram webhook automatically. Manual verification commands are:

```bash
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/health"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Do not paste or print token values when sharing verification output.

Operational references:

- `docs/OBSERVABILITY.md`
- `docs/IMPLEMENTATION_ROADMAP_FA.md`
- `docs/CLOUDFLARE_PAGES_MINI_APP.md`
