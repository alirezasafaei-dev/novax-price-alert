# Roadmap

This roadmap reflects the current state after the alert-hardening work merged on 2026-06-03. For the detailed Persian execution backlog, see `docs/NEXT_STEPS_AND_ROADMAP_FA.md`.

## Current Baseline

The project now includes:

- FastAPI backend models and APIs for assets, prices, alerts, alert events, lifecycle states, freshness-aware evaluation, and notification dispatch.
- Cloudflare Telegram Worker for the user-facing bot flow, KV-backed sessions/alerts, price views, and cron evaluation.
- Alert hardening contracts covering canonical asset identity, normalized price presentation, confirmation-based activation, lifecycle states, trigger/send idempotency, freshness behavior, and structured observability.
- Automated backend and Worker tests for alert creation, duplicate prevention, stale/unavailable data handling, retry behavior, and Telegram full-flow behavior.

## Phase A — Release Stabilization and Documentation Alignment

### Goals

- Validate the merged hardening work in a staging/dev runtime.
- Ensure docs, runtime behavior, and operator expectations match.
- Prepare a safe rollback path before broader rollout.

### Deliverables

- Staging migration run and verification.
- Backend and Cloudflare Worker test suite results.
- Updated bot behavior and operations docs.
- Go/No-Go checklist for production rollout.
- Rollback instructions for Worker/runtime failures.

### Exit Criteria

- No critical doc/runtime mismatch remains.
- Alerts do not activate without explicit confirmation.
- Duplicate sends are not observed in repeated cron checks.
- Stale or unavailable provider data does not trigger alerts.

## Phase B — Limited Production Rollout

### Goals

- Exercise the hardened Telegram alert flow with low-risk real alerts.
- Observe at least two cron cycles after creating test alerts.
- Confirm lifecycle logs and operational signals are usable.

### Deliverables

- Manual test alerts for crypto, fiat, and gold markets.
- Evidence that delivered alerts are not resent.
- Logs for `alert_activated`, `alert_evaluated`, `notification_send_started`, and `notification_send_succeeded`.
- Incident notes if any duplicate, provider, or send failure occurs.

### Exit Criteria

- Zero duplicate notifications.
- No trigger from missing/unavailable prices.
- Delivered alerts are finalized and disabled.
- Operators can trace a notification by alert/event/worker identifiers.

## Phase C — Observability and Operational Gates

### Goals

- Make production behavior inspectable enough for safe ongoing operation.
- Define thresholds that pause rollout or trigger incident response.

### Deliverables

- Log query/runbook for lifecycle events.
- Daily operational checks for Worker health, webhook state, cron execution, provider health, and send failures.
- Duplicate notification incident runbook.
- Retention expectations for delivered/cancelled alerts.

### Exit Criteria

- Operators can answer: which alert fired, why it fired, which price was used, whether it sent, and whether it retried.
- Any duplicate notification is treated as a release-stopping event.

## Phase D — Source-of-Truth Decision

### Goals

- Decide whether Telegram Worker KV remains the short-term source of truth or whether alert persistence/evaluation should move fully to the backend database.

### Options

1. **KV-first short-term path**
   - Keep Worker KV for alerts and sessions.
   - Add stronger lock/retention/debug tooling as usage grows.

2. **Backend source-of-truth path**
   - Worker keeps only conversation sessions in KV.
   - Backend APIs own alert create/confirm/list/delete and evaluation.
   - Backend workers own notification retries and history.

### Exit Criteria

- A short ADR documents the selected path and migration plan.

## Phase E — Product Expansion After Reliability Is Stable

### Candidate Work

- Pause/resume alerts in Telegram.
- Edit target/condition after activation with re-confirmation.
- Recurring alerts with cooldown.
- More assets and provider integrations.
- Provider health dashboard.
- Alert history and user-facing delivery status.
- Mini App or web dashboard for alert management.

## Prioritization Rule

Reliability work remains higher priority than product expansion until production evidence shows:

- no duplicate sends,
- no stale-data triggers,
- no invalid critical transitions,
- and enough observability to debug failures.
