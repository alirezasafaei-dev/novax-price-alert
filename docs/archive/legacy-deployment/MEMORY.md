# Project Memory

This file is for durable context that should survive model or chat changes.
Keep it short and update it only when the project reality changes.

## Last Known Good State

- Telegram bot and Cloudflare relay are operating in production.
- The bot is menu-driven and uses buttons for the main flows.
- Crypto prices are sourced from Binance in `USDT`.
- Fiat and gold prices are sourced from TGJU in `Toman`.
- Alerts are created in stages and activated only after explicit confirmation.
- Cron evaluates alerts every 10 minutes.

## Current Documentation Contract

- `README.md` is the root entrypoint.
- `INDEX.md` is the quick navigation map.
- `docs/README.md` is the docs index.
- `docs/PROGRESS.md` is the live progress note.
- `docs/archive/` is the home for retired docs.
- active docs must be self-contained and not depend on retired drafts.

## Important Current Code Facts

- The canonical application package is `src/novax_price_alert/`.
- The Telegram relay lives in `deploy/cloudflare-worker/`.
- The domain model now uses canonical asset identity for alerts.
- Alert lifecycle is stateful and confirmation-gated.

## Open Work

- Keep active docs aligned with the codebase.
- Reduce duplicate documentation whenever a single living doc is enough.
- Keep archive content out of the active navigation path.

## Memory Update Rule

Update this file only when one of the following changes:

- production status changes
- pricing source changes
- alert flow semantics change
- the canonical docs layout changes
- a new long-lived architectural decision is made
