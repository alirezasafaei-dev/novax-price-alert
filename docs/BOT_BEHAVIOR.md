# Bale Bot Behavior

## Purpose

The Bale bot is the user-facing entrypoint for the MVP.  
Its role is intentionally simple:

- identify users
- provide basic help
- show latest prices
- support simple onboarding to alerts
- deliver triggered alert notifications

## Webhook Responsibility

The webhook endpoint is responsible for:

- accepting Bale updates
- parsing user and message data defensively
- identifying supported commands
- invoking the appropriate application behavior
- returning a safe response quickly

The webhook should avoid slow or failure-prone logic in the request path where possible.

## Defensive Parsing Philosophy

Webhook payloads must be treated as untrusted input.

Rules:

- missing fields must not crash the app
- unknown payload shapes must be tolerated
- malformed requests should produce safe handled responses
- internal errors should be logged safely
- secrets and sensitive payload content should not be exposed in logs

## Supported Commands

### `/start`
Purpose:
- register or refresh the Bale user
- welcome the user
- explain the primary value of the bot

Expected behavior:
- extract user identity
- create user if not found
- update known metadata if useful
- send or return welcome message

### `/help`
Purpose:
- explain available commands
- set expectation for MVP limitations

Expected content:
- supported commands
- how prices work
- how alerts work in MVP
- support for mock/simple flows

### `/prices`
Purpose:
- show latest prices for a small set of core assets

Expected behavior:
- load latest known prices
- format compact readable output
- send or return a message

Suggested assets:
- USDT
- USD
- EUR
- BTC
- ETH
- GOLD18
- EMAMI_COIN

### `/alert`
Purpose:
- provide alert creation guidance in MVP

Expected behavior:
- explain how alert rules are created
- if no conversational flow exists yet, return instructions rather than pretending full automation exists

## Malformed Payload Handling

Examples of malformed cases:

- missing `message`
- missing `from`
- missing user id
- message text not present
- unsupported command
- payload shape mismatch

Recommended behavior:
- return a safe success response with `handled: false` or equivalent
- log enough to debug
- avoid raising unhandled exceptions

## Mock Mode Behavior

If Bale integration is not configured:

- the system should run in mock mode
- outgoing messages should be logged instead of actually sent
- alert workflow should still complete
- delivery tracking should indicate mock or simulated behavior where appropriate

This allows local development and safer staged deployment.

## Message Formatting Guidelines

Messages should be:

- concise
- readable in mobile chat
- stable in structure
- resilient to missing optional user data
- explicit about unsupported flows

### Welcome Message
Should include:
- greeting
- short description of bot purpose
- list of available commands

### Help Message
Should include:
- `/start`
- `/help`
- `/prices`
- `/alert`

### Prices Message
Should include:
- asset code/name
- numeric price
- currency
- freshness indicator if available

### Alert Triggered Message
Should include:
- asset
- current price
- alert direction
- threshold
- timestamp if useful

## Future Expansion Notes

Possible post-MVP improvements:

- guided conversational alert creation
- inline-style menus if supported
- alert list and deletion via bot
- user preferences
- localization refinement
- richer formatting/templates

## Current Telegram Worker Alert Flow

The Cloudflare Telegram worker now follows the same hardening contract as the backend for the user-facing alert path:

1. choose market
2. choose asset
3. choose condition
4. enter target price
5. review summary
6. explicitly confirm activation

Runtime rules:

- The session state uses explicit flow states such as `choosing_asset`, `choosing_condition`, `entering_price`, and `awaiting_confirmation`.
- Asset identity is stored as `canonical_asset_id` (`market:symbol`) and user-facing labels are copied to `display_asset_name_at_creation`.
- Price input is normalized before the pending alert is shown for review.
- The confirmation summary shows asset, condition, normalized target, unit, and current price when available.
- The user can correct the target price before confirmation.
- A persisted alert is activated only after the confirmation callback.

Worker alert records include lifecycle fields such as `lifecycle_state`, `confirmed_at`, `triggered_at`, and `delivered_at`. The cron path evaluates only active alerts, claims a matching alert before sending, records a deterministic trigger event ID, finalizes delivered alerts, and avoids re-sending delivered alerts.

Freshness behavior in the worker is intentionally conservative: each cron run treats prices fetched during that run as fresh, and blocks alert evaluation for unavailable provider batches or missing asset prices while logging `stale_data_detected` with a reason.
