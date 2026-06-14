# Telegram-First Runbook

## Goal

- Keep `novax-price-alert` live through the Cloudflare Worker runtime.
- Preserve the alert engine while adding lightweight growth and lead-capture flows inside Telegram.

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
- `/contact`
- `/lead <message>`

## Alert Flow

- Price alert flow remains the product core.
- Growth additions must not break:
  - alert creation
  - alert management
  - cron evaluation
  - Telegram delivery

## Lead Handling

- User leads are accepted through `/lead <message>`.
- If `OPS_CHAT_ID` is configured as a Worker secret, the lead is forwarded to the operator chat.
- If `OPS_CHAT_ID` is missing, the user still gets a successful confirmation message.

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
  `start -> help/status -> faq/contact -> lead`
