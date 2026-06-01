---
name: novax-bot-deploy-and-test
description: How to deploy and live-test the Novax Telegram price bot (Cloudflare Worker). Use when deploying the worker, configuring its webhook, or running end-to-end tests against @novax_price_bot.
---

# Novax Telegram price bot — deploy & test

## What it is
- Interactive menu-driven Telegram bot running as a Cloudflare Worker. Entry point: `deploy/cloudflare-worker/src/index.js` (set in `wrangler.toml`). `telegram-relay.js` is the old command-style bot and is deprecated.
- Bot handle: `@novax_price_bot`. Live worker URL: `https://novax-telegram-relay.asdevelooper.workers.dev`. Webhook path: `<origin>/webhook`.

## Data sources (important — units differ)
- **Crypto** = Binance public API `data-api.binance.vision/api/v3/ticker/price`. Assets BTC/ETH/SOL/BNB -> symbols `BTCUSDT`/`ETHUSDT`/`SOLUSDT`/`BNBUSDT`. Unit shown to user: **USDT**.
- **Fiat + Gold** = TGJU. Unit shown to user: **تومان** (rial/10). Keys: USD=`price_dollar_rl`, EUR=`price_eur`, GOLD_18K=`geram18`, SEKKEH_EMAMI=`sekee`.
- **TGJU gotcha:** the old endpoint `api.tgju.org/v1/market/indicator/summary-table-data/global-market` now returns HTTP 500 (symptom in bot: `خطا در دریافت قیمت‌ها` for ارز/طلا). Use the mirror endpoints with fallback: `https://call2.tgju.org/ajax.json`, `call3`, `call1`. Values live under a `current` object and are comma-separated rial strings (parse by stripping commas, then divide by 10 for تومان). See `src/prices.js` `getIranMarketPrices()`.

## Secrets / auth
- Secrets live ONLY in repo-root `.env` (gitignored) — never commit. Required: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- A valid Cloudflare API token needs Workers Scripts (Edit), Workers KV Storage (Edit), Account Settings (Read). Verify it before deploy: `curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify`.

## Deploy
```bash
bash deploy/cloudflare-worker/scripts/deploy.sh        # reads ../../.env, runs wrangler deploy + uploads secrets
bash deploy/cloudflare-worker/scripts/set-webhook.sh   # registers the Telegram webhook with the secret token
```
Smoke test: `GET /health` -> ok; webhook POST with correct `X-Telegram-Bot-Api-Secret-Token` -> 200, wrong secret -> 401.

## Unit tests + lint (run from deploy/cloudflare-worker)
```bash
cd deploy/cloudflare-worker && npm test && npm run lint
```
The TGJU/Binance mocks in `test/new-bot.test.mjs` must mirror the real response shapes (TGJU = nested `current`, comma rial strings).

## Live e2e test (Telegram Web)
Full plan in repo root `TEST_PLAN_bot.md`. 8 tests: (1) `/start` 4-button menu, (2) crypto BTC/ETH/SOL/BNB in USDT, (3) fiat USD+EUR in تومان, (4) gold in تومان, (5) alert wizard + `🔙 بازگشت` (verify `back:asset`, formerly dead) with USDT unit, (6) `هشدارهای من` shows current price + `🗑 حذف` per alert, (7) delete alert, (8) help mentions `BTC/ETH/SOL/BNB از Binance`.
- The 10-min cron alert trigger is covered by `new-bot.test.mjs`; not practical to verify live.
- Adversarial check for the core change: seeing old coins (DOGE/SHIB/TRX/ADA/DOT) or `تومان` on the crypto screen = FAIL.
