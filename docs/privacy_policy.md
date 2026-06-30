# Privacy Policy

Novax Price Alert stores the minimum data needed to operate Telegram price alerts and the Mini App.

## Data we process

- Telegram profile fields from Telegram WebApp/initData or bot messages: user id, username, first name, last name, language code.
- Alert settings: asset, target price, condition, lifecycle state, timestamps, delivery status, and alert events.
- Subscription and manual payment request records, including user-submitted payment references. We do not ask for card numbers, but manual references are payment-related data.
- Price snapshots and provider metadata used for alert evaluation and Mini App history.
- Operational logs with redacted structured fields. Bot tokens and secrets must not be logged.

## Storage

Production stores product data in Cloudflare D1. KV is used for Mini App assets, sessions, and low-risk user/cache data. Telegram receives messages needed to operate the bot.

## Deletion

Users can delete individual alerts from the bot/Mini App. A full self-service `/deleteall` command is not currently implemented; contact the operator for account/data deletion requests.
