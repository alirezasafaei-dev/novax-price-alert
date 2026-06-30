# Architecture

Current production is **Cloudflare Worker + Cloudflare D1 + Telegram Mini App**.
FastAPI, PostgreSQL, RQ, Render, and KV-only alert storage are legacy/archive paths and must not be used for new production decisions unless explicitly reactivated.

## Production runtime

```text
Telegram user
  -> Telegram webhook / Mini App
  -> Cloudflare Worker (`deploy/cloudflare-worker/src/index.js`)
  -> D1 (`DB`) for users, alerts, alert events, subscriptions, payments, price snapshots
  -> KV namespaces for mini-app assets, sessions, and low-risk user/cache data
  -> Telegram Bot API for outbound messages
```

## Storage rules

- `DB` (D1) is required in production (`REQUIRE_D1=true`). Alert, payment, and subscription flows fail closed if D1 is unavailable.
- `ASSETS_KV` stores Mini App static assets. `ALERTS_KV` remains only for legacy/local fallback and idempotency helpers.
- `SESSIONS_KV` stores short-lived bot/session state.
- `USERS_KV` stores low-risk Mini App profile cache; D1 remains canonical for product data.

## Scheduling and freshness

Cloudflare Cron invokes the Worker every minute. Free-plan alerts are eligible roughly every 10 minutes; Pro-plan alerts every minute. Stale or unavailable provider data is logged and skipped, not used to trigger alerts.

## Legacy paths

The Python FastAPI app, PostgreSQL migrations, RQ workers, Render docs, and old KV-only bot docs are historical implementation assets. Keep them passing where CI requires it, but production operations should use the Worker/D1 docs first.
