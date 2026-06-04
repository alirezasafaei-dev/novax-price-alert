# Agent Guide

This repository is a lightweight, menu-driven Telegram price alert system.
This file is the first stop for any new agent or chat session.

## Mission

- Keep the docs small, current, and easy to trust.
- Avoid duplicate work, duplicated docs, and stale guidance.
- Prefer changes that reduce future token burn for new agents.

## Current Source of Truth

- `README.md` is the root entrypoint.
- `docs/README.md` is the active docs index.
- `docs/PROGRESS.md` tracks the current implementation status.
- `docs/archive/` contains retired, duplicated, or phase-specific docs.
- `docs/adr/` contains durable architecture decisions.

## What This Project Is

- Telegram bot for price lookup and price alerts.
- Crypto prices come from Binance in `USDT`.
- Fiat and gold prices come from TGJU in `Toman`.
- Alerts are staged and only activate after explicit confirmation.
- Cron checks alerts every 10 minutes.

## What To Trust First

1. Read `README.md`.
2. Read `docs/README.md`.
3. Read `docs/PROGRESS.md`.
4. Inspect code before trusting any old checklist or design draft.

## What Not To Reuse Blindly

- Old root status files.
- Old checklists and release-readiness drafts.
- Archived contract docs unless a living doc links back to them.
- Any price/provider assumption that is not visible in code.

## Working Rules

- Do not recreate a document if a living one already covers it.
- Prefer one short living doc over multiple overlapping drafts.
- If a doc becomes historical, move it to `docs/archive/`.
- Keep progress docs aligned with real code, not intended behavior.
- Never overwrite user changes in unrelated files.

## Useful Code Facts

- Main app package: `src/novax_price_alert`
- Telegram relay code: `deploy/cloudflare-worker/`
- Tests: `tests/`
- Database migrations: `migrations/versions/`

## When Updating Docs

- Prefer short, concrete, current statements.
- Separate "done now" from "future nice-to-haves."
- Mention archive paths for removed or superseded material.
- Avoid repeating the same information across multiple files.

