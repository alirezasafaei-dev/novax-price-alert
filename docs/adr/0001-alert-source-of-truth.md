# ADR 0001: Alert Source of Truth

## Status

Proposed, short-term accepted for post-hardening rollout.

## Context

The system currently has two hardened alert paths:

1. Backend FastAPI/DB domain model with lifecycle states, confirmation, canonical asset identity, normalized prices, freshness-aware evaluation, idempotent alert events, and dispatcher claim/finalization.
2. Cloudflare Telegram Worker with menu-driven user flow, KV alert persistence, explicit confirmation, canonical asset ids, display/unit snapshots, cron evaluation, conservative provider freshness handling, and simple KV claim/finalization.

The production Telegram bot currently uses Cloudflare Worker KV directly for bot-created alerts. Moving all bot alerts immediately to backend DB would improve auditability and future dashboard/API integration, but it adds migration and operational coupling during the release stabilization phase.

## Decision

Short-term: **Telegram Worker KV remains the source of truth for bot alerts**.

- Backend remains hardened and ready for migration.
- Worker KV remains responsible for production bot alert create/confirm/list/delete and cron delivery.
- Revisit the decision when usage, audit, retry, multi-channel notification, or dashboard needs grow.

## Tradeoffs

### Benefits of KV-first now

- Lowest-risk rollout because it preserves the current production path.
- Simple deployment and low latency inside the Worker.
- Fewer moving parts during duplicate-prevention and provider-freshness validation.
- Backend hardening can continue to be validated independently before taking production bot traffic.

### Costs of KV-first now

- KV is weaker than a relational DB for cross-alert queries, audit trails, and transactional guarantees.
- Incident response requires KV inspection and log correlation rather than SQL queries.
- Advanced retry, dashboards, recurring alerts, and multi-channel delivery will be harder to implement cleanly in Worker-only storage.
- Stronger concurrency controls may eventually require Durable Objects, lock keys, or a backend claim endpoint.

## Migration path to backend DB

1. Keep Worker sessions in KV, but switch alert persistence to backend endpoints:
   - `POST /api/v1/alerts`
   - `POST /api/v1/alerts/{alert_id}/confirm`
   - `GET /api/v1/alerts`
   - `PATCH`/`DELETE /api/v1/alerts/{alert_id}`
2. Add a Worker-side backend client with retries, timeouts, auth, and structured error logging.
3. Run dual-write or shadow-read validation for a limited period if data consistency risk is high.
4. Backfill existing KV active/delivered/cancelled alerts into backend DB with canonical asset id, display snapshot, unit snapshot, lifecycle timestamps, and trigger event ids.
5. Move cron evaluation to backend workers or make Worker cron call backend evaluation/dispatch endpoints.
6. Retain KV only for short-lived Telegram conversation sessions and possibly webhook deduplication.

## Revisit triggers

Re-evaluate this ADR when any of the following happen:

- Active alert volume or user count makes KV inspection/operation risky.
- Product needs alert history, dashboard, audit, or support tooling.
- Notification retry requirements exceed simple one-shot delivery.
- Multiple notification channels are introduced.
- Duplicate-prevention requires stronger transactional semantics than KV can safely provide.
