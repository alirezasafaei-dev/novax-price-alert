# Post-Deploy Live Verification Policy — Novax Price Alert

**Status:** Mandatory  
**Product:** Novax Telegram bot, Cloudflare Worker, D1 storage, mini-app if enabled

## Rule

A Novax deployment is not complete until the live public Worker/bot endpoints and the critical Telegram flows are verified with evidence.

Build success, `wrangler deploy`, webhook update, or `/health` alone is not enough.

## Required live checks after every deploy

### Worker/API checks

- production Worker URL opens
- `/health` returns ok
- alert storage status is correct
- webhook route accepts Telegram format only when valid
- no secrets are printed in responses or logs
- rate limiting/dedup does not break normal updates

### Telegram bot checks

Use safe manual or scripted checks when token/admin access is available:

- bot starts in private chat
- deep-link start payload works
- group upgrade does not expose card/payment data
- private upgrade can show payment instructions
- receipt text/photo/document path notifies admin/operator
- admin stats command is restricted
- alert creation flow works
- alert listing/deletion works

### Mini-app checks if configured

- mini-app URL loads publicly
- Telegram WebApp initData behavior is documented/tested
- mini_app_opened event is recorded if analytics is enabled
- no CORS/origin errors

### Analytics checks

Verify event capture for:

- bot_started
- command_used
- callback_clicked
- upgrade_clicked
- payment_receipt_submitted
- alert_created
- alert_triggered if simulated safely
- mini_app_opened if applicable

Do not log receipt content, card data, tokens, or private files into analytics.

## Required verdict

Every deployment report must end with exactly one verdict:

- `LIVE_VERIFICATION_PASS`
- `LIVE_VERIFICATION_PASS_WITH_WARNINGS`
- `LIVE_VERIFICATION_FAIL_ROLLBACK_RECOMMENDED`
- `LIVE_VERIFICATION_FAIL_HOTFIX_REQUIRED`
- `DEPLOY_BLOCKED_NOT_VERIFIED`

## Required report

Write a report to:

```text
docs/reports/live-verification/YYYYMMDD-HHMM-novax.md
```

or:

```text
reports/live-verification/YYYYMMDD-HHMM-novax.md
```

Include:

- deployed commit
- Worker URL
- webhook status evidence
- health output redacted
- Telegram flow results
- mini-app results if applicable
- analytics/event checks
- failures by severity
- rollback/hotfix recommendation
- verdict

## Definition of done

Novax deploy is done only when Worker, webhook, bot flows, payment/privacy safeguards, and analytics checks are verified or explicitly documented as blocked.
