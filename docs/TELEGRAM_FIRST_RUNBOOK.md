# Telegram-First Runbook

## Goal

- Keep `novax-price-alert` live through the Cloudflare Worker runtime.
- Preserve the alert engine and keep the Telegram mini-app dashboard directly reachable from the bot menu.

## Live Endpoints

- `GET /health`
- `GET /status`
- `GET /setup-webhook`
- `GET /setup-bot`
- `POST /webhook`

Current production worker:

- `https://novax-telegram-relay.asdevelooper.workers.dev`

## Core Commands

- `/start`
- `/help`
- `/prices`
- `/faq`

## Alert Flow

- Price alert flow remains the product core.
- Growth additions must not break:
  - alert creation
  - alert management
  - cron evaluation
  - Telegram delivery

## Dashboard Handling

- The reply keyboard includes `🌐 داشبورد هوشمند`.
- The dashboard button sends an inline Telegram `web_app` button when `NOVAX_MINI_APP_URL` or `MINI_APP_URL` is configured.
- `📝 ثبت درخواست` and `💬 تماس` are intentionally not exposed in the user menu.

## Standard Rollout

```bash
cd deploy/cloudflare-worker
npx wrangler deploy
curl -fsS https://novax-telegram-relay.asdevelooper.workers.dev/setup-bot
curl -fsS https://novax-telegram-relay.asdevelooper.workers.dev/health
```

## Shared Rule With `halo-secret`

- Keep both projects Cloudflare-first and Telegram-first.
- Standardize CTA flow as:
  `start -> help/status -> faq -> smart dashboard`
