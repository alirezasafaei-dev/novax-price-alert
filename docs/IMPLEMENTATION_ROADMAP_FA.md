# Implementation Roadmap

This roadmap turns the archived improvement reports and the current codebase into an executable plan.

## Goal

Make the current Telegram bot and Telegram Mini App stack more reliable, more explicit, and easier to maintain without expanding scope unnecessarily.

## Guiding Principles

- Keep the bot menu-driven and simple.
- Treat alert confirmation as mandatory.
- Keep canonical asset identity and explicit units everywhere.
- Prefer reliability and observability over new surface area.
- Keep active docs short; keep history in `docs/archive/`.

## Phase 0: Baseline Freeze

### Objective

Lock the current behavior as the reference baseline.

### Deliverables

- active docs aligned with code
- archived improvement reports retained for reference
- production facts documented in `PROGRESS.md`

### Tasks

- verify `README.md`, `AGENTS.md`, `INDEX.md`, and `MEMORY.md`
- keep the active docs set short
- move phase-specific docs to archive

### Acceptance

- a new agent can find the source of truth in under 2 minutes
- no active doc contradicts the codebase reality

## Phase 1: UX Clarity

### Objective

Remove ambiguity from price display and alert creation.

### Deliverables

- explicit asset labels in all sensitive flows
- staged alert flow with clear summary and confirm step
- consistent terminology for units and prices

### Tasks

- keep the alert wizard step-based
- ensure target price and unit are always visible
- keep delete/list flows easy to understand

### Acceptance

- a user can create an alert without guessing the target asset or unit
- summary and confirmation show the same asset and unit the code stores

## Phase 2: Reliability Hardening

### Objective

Protect the system from duplicate alerts, stale data, and ambiguous state transitions.

### Deliverables

- canonical asset identity in the data model
- lifecycle-gated alerts
- idempotent notification delivery
- freshness-aware trigger behavior

### Tasks

- keep alert state transitions explicit and validated
- keep stale/unavailable data from triggering notifications
- keep send retries from creating duplicate user-visible events

### Acceptance

- duplicate send is treated as an incident
- stale data never produces a false trigger
- confirmed alerts remain traceable through logs and state

## Phase 3: Observability and Operations

### Objective

Make runtime health visible and supportable.

### Deliverables

- structured log contract
- cron heartbeat monitor
- runbook for incident handling
- deploy/release checklist

### Tasks

- watch `alert_evaluated`, `notification_send_*`, and `stale_data_detected`
- keep `/status` monitored from outside the Worker
- keep `/health` and `/api/v1/prices/latest` in release checks

### Acceptance

- operators can tell whether cron is healthy
- operators can trace an alert from creation to delivery
- a rollout can be paused using logs and health endpoints

## Phase 4: Controlled Expansion

### Objective

Add only the next most valuable improvements after the core is stable.

### Candidate Work

- metrics and dashboards
- price history
- broader asset coverage
- richer Telegram UX improvements

### Acceptance

- expansion does not regress the baseline alert and pricing flow
- every new feature has a clear owner and rollback path

## Milestone Checklist

### Milestone A

- active docs aligned
- baseline behavior frozen

### Milestone B

- alert flow explicit and confirm-gated

### Milestone C

- duplicate prevention and stale-data protection stable

### Milestone D

- observability and ops runbooks usable in production

## How to Use This File

- Use it as the execution layer after reading `PROGRESS.md`.
- Break each phase into tickets or PRs.
- Do not add new features before the current phase is accepted.
