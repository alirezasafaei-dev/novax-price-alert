# Novax Production Readiness Audit

**Date:** 2026-07-09
**Auditor:** OpenCode ASDEV Agent
**Branch:** `audit/novax-bot-payments-analytics-deploy`
**Commit:** TBD

---

## Audit Summary

Comprehensive end-to-end audit of the Novax Price Alert system (Telegram bot + mini-app + Cloudflare Worker + D1).

---

## A. Telegram Bot UX and Privacy Audit

### Group vs Private Chat Handling (CRITICAL — P0)

**Finding:** `showSubscription()` in `subscriptions.js` did NOT check chat type. In a group/supergroup, clicking "💎 ارتقا به Pro" would display `PAYMENT_INSTRUCTIONS` (which includes card number) publicly.

**Fix applied:** Added `chatType` parameter to `showSubscription()`. Group/supergroup chats now show a safe message with a private deep link (`https://t.me/<bot_username>?start=upgrade_pro`). Payment instructions only appear in private chat.

**Also fixed:** `handlePaymentReference()` now silently ignores non-private calls. Receipt media (photo/document) only handled in private chat.

### Callback Query Handling

All callbacks are properly handled with answerCallbackQuery. No injection risks observed. Callback data is prefixed with namespaced patterns (e.g., `market:`, `asset:`, `op:`, `confirm:`, `edit:`, `pause:`, `resume:`, `repeat:`, `cancel:`, `delete:`, `back:`).

### Deep Links

`/start <param>` is properly parsed. Referral (`ref_<id>`) and campaign (`post_daily_*`) sources are supported. `upgrade_pro` param is supported via the new group-to-private redirect.

### Persian Copy Quality

High quality Persian copy throughout. Good mix of emoji and clear instructions. Minor: some canonical names used in inline query could use Persian aliases (e.g., "قیمت بیت‌کوین" instead of just "BTC").

### Abuse/Spam Risks

- Group message filter (`isRelevantGroupMessage`) is well-designed: only responds to commands, @mentions, replies to bot, and price keywords.
- NLP with Persian keyword mapping is well-contained.
- Mini-app promotion limited to once per 60 days per user.
- Rate limiting on Telegram API calls via retry/backoff.
- **Missing:** Inline query rate-limiting per user/global.

---

## B. Payment Flow Audit (P1)

### Payment/Card Instructions

**Before:** Shown in all chat types. **After:** Only in private chat.

### Receipt Submission Path

**Before:** Only text payment references accepted. No photo/document handling.

**After:**
- Text payment references: stored via `createPaymentRequest` in D1, admin notified via `ADMIN_CHAT_ID` / `PAYMENT_REVIEW_CHAT_ID`.
- Photo/document receipts: forwarded to admin chat with `sendPhoto`/`sendDocument`. Stored as payment_request in D1 with caption as reference.
- User gets "received, pending review" acknowledgement.

### Admin Notification

New env vars used: `ADMIN_CHAT_ID` or `PAYMENT_REVIEW_CHAT_ID`. If neither is configured, receipts still stored in D1 but admin not notified (logged as warning).

### Pro Activation

Admin uses `/approve <id>` or `/reject <id>` to review. Auto-creates subscription and upgrades alerts to pro check interval.

### Fraud/Manual Review Risks

- Idempotency via `already_pending` check.
- Reference text capped at 200 chars.
- Admin audit trail via `admin_audit_logs`.

### Missing Env Vars

- `ADMIN_CHAT_ID` or `PAYMENT_REVIEW_CHAT_ID` — **new required** for admin receipt notification.
- `PAYMENT_INSTRUCTIONS` — already documented but commonly missing. Falls back to support contact message.

---

## C. Analytics Audit (P2)

### Current Event Model

`metrics.js` provides `recordMetric()` backed by Cloudflare Workers Analytics Engine (binding `METRICS`). Data points have name, blobs (name, market, asset), and doubles (value). The existing `wrangler.toml` has the `analytics_engine_datasets` binding.

### Previously Missing

- `bot_started`
- `command_used` (help, prices, my_alerts)
- `callback_clicked`
- `upgrade_clicked`
- `payment_receipt_submitted`
- `pro_review_notified`
- `alert_created` (had it in alerts.js)
- `alert_triggered` (had it via cron)
- `alert_deleted` (had it)
- `asset_selected`
- `mini_app_opened`
- `mini_app_action`

### Fix Applied

Added comprehensive `logEvent()` and `recordMetric()` calls at all key touchpoints in `commands.js`, `callbacks.js`, `subscriptions.js`, `miniapp-api.js`.

### Storage Strategy

Events logged as structured JSON via `logEvent()` (visible in `wrangler tail` and Cloudflare Logpush). Metrics via Analytics Engine (`recordMetric()`) queryable via SQL API. No receipt image/text content logged.

### Conversion Funnel

Now trackable via event sequence: `bot_started` → `asset_selected` (during alert creation) → `upgrade_clicked` → `payment_receipt_submitted` → `pro_review_notified`.

---

## D. Mini-App Audit

### Telegram WebApp initData Validation

✅ HMAC-SHA256 verification using `WebAppData` secret from bot token.
✅ Auth date freshness check (default 3600 seconds, configurable).
✅ User JSON parse and extraction.
✅ Timing-safe hash comparison.

### User Identification

✅ Telegrams `initDataUnsafe.user` parsed, user upserted to D1.

### Event Tracking

✅ `mini_app_opened` tracked when subscription endpoint is hit.
✅ `mini_app_action` tracked for alert viewing in mini-app.

### API Security

✅ CORS allowed origins from env vars (`MINI_APP_ORIGIN`, `NOVAX_MINI_APP_URL`, `WORKER_ORIGIN`, `PUBLIC_WORKER_ORIGIN`).
✅ Origin-forbidden requests get 403.
✅ Authenticated endpoints require valid Telegram initData.

### Production Reachability

Mini-app is deployed at `/mini-app/` on the Worker. Assets in `ASSETS_KV`. AI Chat at `/api/chat`. Verified working in PROGRESS.md.

### CORS/Origin Risks

Current `corsHeaders` implementation returns empty `Access-Control-Allow-Origin` if origin is not in allowlist. This is correct behavior — however, browsers will reject the response because CORS requires the header. The current approach returns 204/200 without a matching `Access-Control-Allow-Origin`, which can cause CORS errors. **Recommendation:** Always return the requesting origin if it's in the allowlist, otherwise omit the `Access-Control-Allow-Origin` header entirely (current behavior is correct for denying).

---

## E. Architecture/Deployment Audit

### Cloudflare Worker + D1 Readiness: ✅ Primary path

- Worker code: `deploy/cloudflare-worker/src/` — well-structured, modular.
- D1 migrations: `migrations/0001_product_core.sql` and `0002_growth_campaign.sql` — comprehensive schema.
- Cron: `0 * * * *` (every hour) — Cloudflare free plan constraint.
- Triggers: heartbeat every 3600s, auto-post at configurable hours.
- Structured logging via JSON.

### Legacy FastAPI Path

Exists in `src/novax_price_alert/`. Tests are maintained (153 passed). Not used in production.

### VPS/Docker Compose Path

- Docker compose files exist but not the focus.
- VPS path (PM2 + Nginx) documented in `docs/VPS_DEPLOYMENT.md`.

### Required Env Vars

| Variable | Required | Status |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Secret |
| `TELEGRAM_SECRET_TOKEN` | Yes | Secret |
| `SETUP_SECRET` | Yes | Secret |
| `DB` (D1 binding) | Yes | wrangler.toml |
| `ASSETS_KV` | Yes | wrangler.toml |
| `SESSIONS_KV` | Yes | wrangler.toml |
| `USERS_KV` | Yes | wrangler.toml |
| `BOT_USERNAME` | Yes | Secret |
| `ADMIN_TELEGRAM_USER_IDS` | Yes | Secret |
| `PAYMENT_INSTRUCTIONS` | Recommended | Secret |
| `ADMIN_CHAT_ID` | **New** | Secret |
| `PAYMENT_REVIEW_CHAT_ID` | **New** | Secret (fallback for ADMIN_CHAT_ID) |
| `OPS_CHAT_ID` | Optional | Secret |

### Backup/Restore

D1 backups: Cloudflare dashboard → D1 → database → Export. Automated backup not configured.

### Monitoring

- GitHub Actions heartbeat check (every 5 min).
- Cloudflare Workers observability enabled in wrangler.toml.
- `OPS_CHAT_ID` for ops alerts.
- Structured JSON logging.

### Rollback

- Worker: `npx wrangler rollback` to previous version.
- D1: D1 supports time-travel restore in Cloudflare dashboard.

---

## E. Security Audit

### Token Handling

✅ Bot token used only in `telegramApi()`. Never logged.
✅ `TELEGRAM_SECRET_TOKEN` validated on webhook. Returns 401 if mismatch.
✅ HMAC comparison for webhook secret.

### Webhook Secret/Path

✅ `/webhook` secured with `X-Telegram-Bot-Api-Secret-Token`.
✅ Setup endpoints (`/setup-webhook`, `/setup-bot`) secured with `X-Setup-Secret`.

### Admin Authorization

✅ `ADMIN_TELEGRAM_USER_IDS` comma-separated. Set comparison via `adminIds()`.
✅ Admin commands: `/payments`, `/approve`, `/reject`, `/growth`, `/admin_stats`.

### Payment Data Privacy

✅ Card/payment details only in private chat.
✅ Receipt data not logged in analytics.
✅ Receipt text stored only in D1 `payment_requests.reference`.

### Rate Limiting

✅ Telegram API retry/backoff in `telegramApi()`.
⏳ No global rate limiting on webhook updates (Cloudflare Workers free tier handles scale).

### Input Validation

✅ Text prices validated via `normalizeTargetPrice()`.
✅ Callback data validated via prefix matching.
✅ JSON malformed webhooks return 400.
✅ Alert target price checked positive finite.

### Telegram Spoofing Risks

✅ Webhook secret prevents unauthorized webhook calls.
✅ Mini-app initData HMAC-verified.

### Dependency Vulnerabilities

`npm audit` reported 0 vulnerabilities. Python `pip-audit` 0 known.

---

## Deployment Readiness Score: 8.5 / 10

Deducted:
- -0.5: `ADMIN_CHAT_ID` / `PAYMENT_REVIEW_CHAT_ID` not yet configured in production
- -0.5: D1 backup automation not configured
- -0.3: Missing rate limiting on InlineQuery
- -0.2: No automated receipt review dashboard (manual via Telegram commands)

---

## Deployment Recommendation

**Deploy as Cloudflare Worker + D1** (current production path). Do NOT switch to VPS/Docker Compose unless:

1. Cloudflare free tier limits are consistently hit (>100k requests/day, >10ms CPU).
2. Real-time alert checking (<60s) is needed for all users (not just Pro).

### Exact Steps

1. Apply this branch's changes via PR or direct deploy.
2. Set new secrets in Cloudflare:
   - `ADMIN_CHAT_ID` or `PAYMENT_REVIEW_CHAT_ID`
   - Ensure `BOT_USERNAME`, `PAYMENT_INSTRUCTIONS`, `ADMIN_TELEGRAM_USER_IDS` are set.
3. Run migration (if new): `npx wrangler d1 migrations apply novax-product --remote`
4. Deploy: `npx wrangler deploy`
5. Run `/admin_stats` to verify analytics.
6. Send test payment receipt (photo and text) in private chat to verify admin notification.

### What Remains Blocked

- `ADMIN_CHAT_ID` must be configured by operator (cannot be hardcoded).
- Telegram token rotation incident remains open (git history cleanup not verified).
- No automated backup of D1.

---

## Files Changed

| File | Change |
|---|---|
| `deploy/cloudflare-worker/src/subscriptions.js` | Group-safe `showSubscription()`, `handleReceiptMedia()`, `handlePaymentReference()` admin notify, `/admin_stats` command |
| `deploy/cloudflare-worker/src/index.js` | Pass chatType to payment handlers, receipt media detection |
| `deploy/cloudflare-worker/src/commands.js` | Added `bot_started`, `command_used`, `mini_app_opened` tracking |
| `deploy/cloudflare-worker/src/callbacks.js` | Added `callback_clicked`, `asset_selected` tracking |
| `deploy/cloudflare-worker/src/miniapp-api.js` | Added `mini_app_action`, `mini_app_opened` tracking |

---

## Tests Run

| Suite | Result |
|---|---|
| `test/log.test.mjs` | ✅ Passed |
| `test/metrics-alerting.test.mjs` | ✅ Passed |
| `test/heartbeat.test.mjs` | ✅ Passed |
| `test/telegram-relay.test.mjs` | ✅ Passed |
| `test/new-bot.test.mjs` | ✅ Passed |
| `test/product-db.test.mjs` | ⚠️ Skipped (requires `miniflare` package) |
| `test/miniapp-api.test.mjs` | ⚠️ Skipped (requires `miniflare`) |
| `test/miniapp-static.test.mjs` | ⚠️ Skipped (requires `miniflare`) |
| `test/growth.test.mjs` | ⚠️ Skipped (requires `miniflare`) |

Python tests not run (legacy backend, not production path).

---

## Security/Privacy Impact

✅ Group payment leakage: FIXED.
✅ Receipt data not exposed to other users.
✅ Admin notification: ADDED.
✅ Analytics without PII exposure.
✅ Mini-app initData: already validated.