# Telegram Bot Runbook

## Current Production State

- Bot username: `@novax_price_bot`
- Cloudflare Worker: `https://novax-telegram-relay.asdevelooper.workers.dev`
- Telegram webhook: `https://novax-telegram-relay.asdevelooper.workers.dev/webhook`
- Runtime path: the Cloudflare Worker (`deploy/cloudflare-worker/src/index.js`) is a **menu-driven** bot. It handles the `/start` and `/help` slash commands, four reply-keyboard buttons, the confirmation-based alert wizard (session text), inline callback queries (back/delete/selection), and the scheduled (cron) alert check.
- Price sources:
  - **Crypto**: Binance public API (`data-api.binance.vision/api/v3/ticker/price`), unit **USDT** (BTC, ETH, SOL, BNB).
  - **Fiat/Gold**: TGJU mirrors (`call2/call3/call1.tgju.org/ajax.json`), unit **Toman** (USD, EUR, 18K gold, Emami coin).
- Unit conversion: TGJU values are parsed as Rial (comma-separated strings under the `current` key) and divided by `10` for Toman.
- Time zone: `Asia/Tehran`, Persian calendar formatting.

## Bot Interaction Model (menu-driven)

The bot is button-driven. The only slash commands are `/start` and `/help`; everything else is done via the reply keyboard.

### `/start`
Registers/refreshes the user and shows the 4-button main menu:

```
💰 قیمت‌ها        🔔 تنظیم هشدار
📋 هشدارهای من   ❓ راهنما
```

### `/help` (or `❓ راهنما`)
Sends the usage guide (price sources + confirmation-based alert flow).

### `💰 قیمت‌ها`
Shows a market selection (کریپتو / ارز / طلا); after picking a market, live prices are sent (crypto in USDT, fiat/gold in Toman).

### `🔔 تنظیم هشدار` (confirmation wizard)
Market → asset → condition (above/below) → target price → summary → ✅ confirm. A `🔙 بازگشت` button is available before summary; the summary supports editing the target price or cancelling before activation. No alert is written to `ALERTS_KV` until confirmation.

### `📋 هشدارهای من`
Lists active alerts for the chat, each with the **current price** and a `🗑 حذف` (delete) button.

## Alert Evaluation

Cloudflare Cron Triggers run every 10 minutes (`*/10 * * * *`). The Worker fetches current prices (Binance for crypto, TGJU for fiat/gold), evaluates only `lifecycle_state=active` alerts, skips unavailable provider batches or missing asset prices, claims a matching alert before sending, sends the Telegram notification, and finalizes successful one-shot alerts as `lifecycle_state=delivered` with `enabled=false`. Alerts are stored in the `ALERTS_KV` binding.

> Note: because cron fires on fixed wall-clock minutes (:00, :10, :20, …), a freshly created alert may fire anywhere from 0 to 10 minutes after its condition becomes true. This is expected.

Supported assets:

- Crypto (Binance, USDT): `BTC`, `ETH`, `SOL`, `BNB`
- Fiat (TGJU, Toman): `USD`, `EUR`
- Gold (TGJU, Toman): `GOLD_18K`, `SEKKEH_EMAMI`

## Worker HTTP Endpoints

The deployed Worker exposes exactly these routes:

- `GET /health` → `{"status":"ok","service":"telegram-bot"}`
- `GET /setup-webhook` → sets the Telegram webhook to `/webhook` (using the Worker's own token + secret) and returns `getWebhookInfo`.
- `POST /webhook` → Telegram updates; requires the `X-Telegram-Bot-Api-Secret-Token` header to match `TELEGRAM_SECRET_TOKEN` (otherwise 401).

## Verification Commands

Run from the project root after loading `.env`.

```bash
set -a
. ./.env
set +a

# Worker health
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/health"

# Telegram webhook info (source of truth)
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
```

Expected health:

```json
{"status":"ok","service":"telegram-bot"}
```

Expected webhook URL:

```text
https://novax-telegram-relay.asdevelooper.workers.dev/webhook
```

## Deploy Procedure

```bash
cd deploy/cloudflare-worker
# requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
# TELEGRAM_BOT_TOKEN, and TELEGRAM_SECRET_TOKEN from ../../.env or the environment
bash scripts/deploy.sh
```

`scripts/deploy.sh` validates required secrets without printing them, uploads the Worker secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`), runs `npx wrangler deploy`, sets the Telegram webhook, and prints redacted health/webhook verification output. If a temporary `.env` was created for a one-off deploy, run `DELETE_ENV_AFTER_DEPLOY=1 bash scripts/deploy.sh` so the file is removed on exit.

To (re)set just the webhook without deploying, either open `GET /setup-webhook` in a browser/curl, or run `scripts/set-webhook.sh` (fill in the token/secret first).

## Operational Notes

- Do not commit `.env`, Telegram tokens, Cloudflare tokens, or relay secrets.
- If prices fail, check Worker logs for Binance (crypto) or TGJU (fiat/gold) errors. TGJU has a fallback across `call2 → call3 → call1` mirrors.
- Cloudflare Worker logs can be tailed from `deploy/cloudflare-worker/` using `npx wrangler tail`.
- If alert persistence needs stronger guarantees, ensure the `ALERTS_KV` namespace is bound in `wrangler.toml`.

## Known Good Validation

Last verified behavior (live, end-to-end on `@novax_price_bot`):

- `/start` shows the 4-button menu.
- `💰 قیمت‌ها` → کریپتو shows BTC/ETH/SOL/BNB in USDT (Binance).
- `💰 قیمت‌ها` → ارز/طلا shows USD+EUR and 18K gold/Emami coin in Toman (TGJU).
- `🔔 تنظیم هشدار` completes the market → asset → condition → target → summary → confirm wizard; edit target works before confirmation; cancel before confirmation creates no alert.
- `📋 هشدارهای من` lists alerts with current price and a `🗑 حذف` button; delete works.
- Cron alert fired live within the 0–10 minute window and delivered alerts were not re-sent on later cron runs.

## یادداشت عملیاتی فارسی

### وضعیت معماری فعلی

- Worker مسیر اصلی production است و **منو‌محور** است: `/start` و `/help` به‌علاوه‌ی چهار دکمه‌ی منو، ویزارد confirmation-based هشدار، callbackها و cron ده‌دقیقه‌ای را اجرا می‌کند.
- منبع قیمت: **Binance** برای کریپتو (واحد USDT) و **TGJU** برای ارز/طلا (واحد تومان).
- storage فعلی production با binding `ALERTS_KV` روی Cloudflare KV است.

### چک‌های بعد از deploy

```bash
set -a
. ./.env
set +a
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/health"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
```

اگر webhook درست تنظیم نشده بود، `GET /setup-webhook` را صدا بزنید یا `scripts/deploy.sh` را دوباره اجرا کنید.


## Alert KV fields

Confirmed alerts in `ALERTS_KV` should include:

- `id` / `alert_id`
- `user_id`
- `canonical_asset_id`
- `market` and `symbol`
- `display_asset_name_at_creation`
- `operator` / `condition_type`
- `target` / `target_price_normalized`
- `target_price_display_unit`
- `lifecycle_state`
- `enabled`
- `created_at`, `confirmed_at`, `triggered_at`, `delivered_at`
- `trigger_event_id`

Pending summary data remains in `SESSIONS_KV`; it is not an active alert.

## Rollout log events

During deploy and cron validation, tail logs and watch for:

- `alert_activated`
- `alert_evaluated`
- `stale_data_detected`
- `duplicate_trigger_detected`
- `duplicate_send_detected`
- `notification_send_started`
- `notification_send_succeeded`
- `notification_send_failed`
- `alert_evaluation_job_completed`

Any real duplicate notification or activation without confirmation is a No-Go; follow `docs/RELEASE_READINESS_FA.md` and `docs/OBSERVABILITY.md`.
