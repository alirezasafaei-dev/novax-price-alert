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

```bash
# from deploy/cloudflare-worker
bash scripts/deploy.sh
# or, if secrets/webhook are already configured
npx wrangler deploy
```

Tail production/staging logs:

```bash
npx wrangler tail
```

After deploy, verify:

```bash
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/health"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
```

Operational references:

- `docs/TELEGRAM_RUNBOOK.md`
- `docs/RELEASE_READINESS_FA.md`
- `docs/OBSERVABILITY.md`
