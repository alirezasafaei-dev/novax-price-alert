# Telegram Alert Worker

This Cloudflare Worker is the current production Telegram bot runtime for price alerts. It handles:

- `GET /health`
- `GET /setup-webhook`
- `POST /webhook`
- scheduled cron evaluation of alerts stored in `ALERTS_KV`

Required secrets/bindings:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SECRET_TOKEN`
- `ALERTS_KV`
- `SESSIONS_KV`
- `USERS_KV`

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

- `docs/TELEGRAM_RUNBOOK.md`
- `docs/RELEASE_READINESS_FA.md`
- `docs/OBSERVABILITY.md`
