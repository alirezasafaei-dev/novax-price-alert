# Telegram Bot Runbook

## Current Production State

- Bot username: `@novax_price_bot`
- Cloudflare Worker: `https://novax-telegram-relay.asdevelooper.workers.dev`
- Telegram webhook: `https://novax-telegram-relay.asdevelooper.workers.dev/webhook`
- Runtime path: Cloudflare Worker handles `/start`, `/help`, `/prices`, `/alert`, `/alerts`, `/delete`, scheduled alert checks, and backend relay sends.
- Current price source for `/prices`: TGJU HTML pages fetched from Cloudflare Worker.
- User-facing unit: Toman. TGJU values are parsed as Rial and divided by `10` before display.
- User-facing time zone: `Asia/Tehran`, Persian calendar formatting.

## Supported Commands

### `/start`

Sends the intro/help text and confirms the bot is active.

### `/help`

Sends the same command guide as `/start`.

### `/prices`

Sends a quick loading message, queues price fetch with `ctx.waitUntil`, then sends live prices.


### `/alert <symbol> <target_toman> <above|below>`

Creates a Telegram price alert. Example: `/alert USD 170000 above`. Supported symbols are `USD`, `USDT`, `GOLD`, and `SEKKEH`. Targets are entered in toman.

### `/alerts`

Lists active alerts for the current Telegram chat.

### `/delete <id>`

Deactivates an alert created by the current Telegram chat.

## Alert Evaluation

Cloudflare Cron Triggers run every 10 minutes. The Worker fetches current TGJU prices, evaluates active alerts, sends matching Telegram notifications, and throttles repeat notifications for the same alert to once per hour. Alert data uses the `ALERTS_KV` binding when available and falls back to Worker Cache storage for the production relay.

Displayed assets:

- USD free market: `USD_IRT`
- 18K gold: `GOLD_18K_IRT`
- Emami coin: `SEKKEH_EMAMI_IRT`
- Tether: `USDT_IRT`

## Verification Commands

Run from the project root after loading `.env`.

```bash
set -a
. ./.env
set +a
curl -fsS "$TELEGRAM_RELAY_URL/health"
curl -fsS -H "X-Relay-Secret: $TELEGRAM_RELAY_SECRET" "$TELEGRAM_RELAY_URL/webhook-info"
```

Expected health:

```json
{"status":"ok","service":"telegram-relay"}
```

Expected webhook URL:

```text
https://novax-telegram-relay.asdevelooper.workers.dev/webhook
```

## Manual Send Test

Use this only with a known private chat ID.

```bash
curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -H "X-Relay-Secret: $TELEGRAM_RELAY_SECRET" \
  --data '{"chat_id":"<chat_id>","text":"Novax relay test"}' \
  "$TELEGRAM_RELAY_URL/send"
```

## Deploy Procedure

```bash
set -a
. ./.env
set +a
./scripts/deploy-cloudflare-relay.sh
curl -fsS "$TELEGRAM_RELAY_URL/health"
curl -fsS -X POST -H "X-Relay-Secret: $TELEGRAM_RELAY_SECRET" "$TELEGRAM_RELAY_URL/set-webhook"
```

The deploy script uploads Worker secrets before deploying code.

## Operational Notes

- Do not commit `.env`, Telegram tokens, Cloudflare tokens, relay secrets, or proxy lists.
- If `/prices` is slow, users should still receive the loading message immediately.
- If alert persistence needs stronger guarantees, create a Cloudflare KV namespace named `ALERTS_KV` and bind it in `wrangler.toml`; the current deployable fallback uses Worker Cache storage.
- If TGJU blocks or slows Worker fetches, keep the bot responsive and send the friendly retry message.
- `proxy-list.txt` is local-only and should not be committed.
- Cloudflare Worker logs can be tailed from `deploy/cloudflare-worker/` using `npx wrangler tail`.

## Known Good Validation

Last verified behavior:

- `/start` responds in Telegram.
- `/prices` sends Toman prices.
- `/alert USD 170000 above`, `/alerts`, and `/delete <id>` respond from Telegram webhook.
- Update timestamp is shown in Tehran time.
- Worker webhook returns quickly with `queued: prices` for `/prices`.
