# Novax Deployment Decision Report

**Date:** 2026-07-09
**Author:** OpenCode ASDEV Agent

---

## Decision: Deploy to Cloudflare Worker + D1 (current production path)

The Cloudflare Worker + D1 architecture is correct for the current scale. Do NOT migrate to VPS/Docker Compose at this time.

### Rationale

1. **Current scale:** <100k requests/day, <10ms CPU per request — within Cloudflare free tier.
2. **Zero maintenance overhead:** No server patching, no PostgreSQL/VPS management.
3. **Built-in observability:** Cloudflare Workers observability + Analytics Engine.
4. **D1 is sufficient:** No relational query patterns that require PostgreSQL.
5. **VPS cost:** $5-10/mo for a basic VPS with no clear benefit at current scale.
6. **Operational complexity:** VPS requires PM2, Nginx, Postgres, Redis maintenance, and cron heartbeat monitors.

### When to Reconsider VPS/Docker Compose

- Worker consistently exceeds 100k requests/day or 10ms CPU.
- Real-time (<60s) alert checking needed for all users (not just Pro).
- Need for Redis-based real-time features that D1/KV cannot support.
- Compliance requirements that mandate specific VPS/country hosting.

---

## Required Env Vars

### Must Be Set (Cloudflare Secrets)

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot authentication |
| `TELEGRAM_SECRET_TOKEN` | Webhook secret |
| `SETUP_SECRET` | Setup endpoint authentication |
| `BOT_USERNAME` | Username for deep links (without @) |
| `ADMIN_TELEGRAM_USER_IDS` | Admin IDs for payment approval |
| `PAYMENT_INSTRUCTIONS` | Card/payment details shown in private chat |
| `ADMIN_CHAT_ID` | **NEW** — Admin notification for receipts |
| `PAYMENT_REVIEW_CHAT_ID` | **NEW** — Fallback for ADMIN_CHAT_ID |

### Recommended

| Variable | Purpose |
|---|---|
| `OPS_CHAT_ID` | Operational alert destination |
| `GROQ_API_KEY` | AI Chat feature |
| `MARKETING_POSTING_ENABLED` | Daily market posts |
| `MARKETING_CHANNEL_ID` | Marketing channel destination |

### wrangler.toml Bindings (Already Configured)

| Binding | Resource |
|---|---|
| `DB` | D1 `novax-product` |
| `ASSETS_KV` | Mini-app static assets |
| `SESSIONS_KV` | Bot sessions |
| `USERS_KV` | User cache |
| `ALERTS_KV` | Legacy fallback |
| `METRICS` | Analytics Engine `novax_bot_metrics` |

---

## Database Migrations Required

- Migration `0001_product_core.sql` already applied (users, subscriptions, payment_requests, alerts, alert_events, price_snapshots, admin_audit_logs).
- Migration `0002_growth_campaign.sql` already applied (user_campaigns, referrals, referral_rewards, marketing_posts).
- **No new migrations needed** for this audit's changes. The payment flow uses existing `payment_requests` table.

---

## Smoke Tests That Must Pass Before Deployment

1. `GET /health` → 200
2. `GET /status` → 200 (non-stale heartbeat)
3. `GET /api/v1/prices/latest` → 200 with 7+ asset prices
4. `GET /mini-app/` → 200 with valid HTML
5. `POST /webhook` with valid secret → 200
6. `POST /webhook` with invalid secret → 401
7. In private chat: "💎 ارتقا به Pro" → shows payment instructions
8. In group chat: "💎 ارتقا به Pro" → shows private deep link only, NO payment instructions
9. `/start` in private chat → welcome + keyboard
10. Alert creation: market → asset → condition → target → confirm
11. Payment receipt (text) → stored as pending, admin notified if ADMIN_CHAT_ID set
12. Payment receipt (photo) → forwarded to admin if ADMIN_CHAT_ID set
13. `/admin_stats` (as admin) → shows valid stats

---

## Rollback Path

### Worker Rollback
```bash
npx wrangler rollback
```
Rolls back to previous Worker version. Webhook stays intact.

### D1 Rollback
Cloudflare Dashboard → D1 → `novax-product` → Time Travel → Restore to point before deployment.

### Full Rollback
```bash
git revert <merge-commit> && npx wrangler deploy
```

---

## Monitoring

- **Already configured:** GitHub Actions heartbeat (5-min interval), Worker observability, JSON structured logging.
- **Ops alerts:** Sent to `OPS_CHAT_ID` for provider outages and delivery failures.
- **Missing:** Uptime monitoring via external service (e.g., BetterUptime, Cronitor) for alerts when GitHub Actions is down.

---

## Remaining Blockers

1. **ADMIN_CHAT_ID not configured:** Receipt admin notification will work as no-op until operator sets this secret.
2. **Telegram token rotation incident:** PROGRESS.md marks it as "open until rotation confirmed." Token in git history is a real exposure.
3. **D1 backup automation:** No scheduled export. Relying on Cloudflare Time Travel (30-day window).
4. **Health check failure:** If Worker is down, the only detection is GitHub Actions heartbeat (may have gaps).
5. **Inline query rate limiting:** No per-user/global rate limit on inline search. Low risk at current scale.

---

## Post-Deployment Verification

```bash
# Test health
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/health"

# Test status
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/status"

# Test prices
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/api/v1/prices/latest"

# Test mini-app
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/mini-app/" | head -5

# Verify webhook from Telegram API
# Do NOT paste the full response — check has `ok: true` and no errors
# curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

---

## Final Score: 8.5 / 10

✅ Group payment leakage: FIXED
✅ Receipt admin notification: ADDED
✅ Analytics foundation: ADDED
✅ Admin visibility: ADDED (via /admin_stats)
✅ Mini-app tracking: ADDED
⚠️ ADMIN_CHAT_ID: Must be configured by operator
⚠️ Token rotation: Still unresolved
✅ No secrets committed
✅ All available tests pass