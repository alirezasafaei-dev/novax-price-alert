# Roadmap

This roadmap reflects the comprehensive hardening plan based on the Persian improvement report (`docs/PROJECT_IMPROVEMENT_REPORT_FA/`). The report provides a detailed 6-8 week execution plan to transform the bot from a working MVP to a professional, reliable product for Iranian users.

## Core Principles from Improvement Report

1. **Explicit over Implicit**: Every important decision (asset selection, price unit, condition type, target value, final status) must be explicitly displayed to the user
2. **Consistent Behavior**: System behavior must not vary between different product points
3. **Hardening Before Expansion**: Focus on reliability, clarity, observability before adding new features
4. **Iranian Market Alignment**: 
   - Primary display unit: **Toman (تومان)**
   - Prices must be real-time and market-aligned
   - UX must match Iranian user behavior and market conventions

## Current Baseline

The project now includes:

- FastAPI backend models and APIs for assets, prices, alerts, alert events, lifecycle states, freshness-aware evaluation, and notification dispatch.
- Cloudflare Telegram Worker for the user-facing bot flow, KV-backed sessions/alerts, price views, and cron evaluation.
- Alert hardening contracts covering canonical asset identity, normalized price presentation, confirmation-based activation, lifecycle states, trigger/send idempotency, freshness behavior, and structured observability.
- Automated backend and Worker tests for alert creation, duplicate prevention, stale/unavailable data handling, retry behavior, and Telegram full-flow behavior.

## Critical Issues Identified (from Improvement Report)

1. **Ambiguity in asset selection** - Users unclear which asset alert is registered for
2. **Ambiguity in Alert Flow** - Unclear process for creating alerts
3. **Duplicate alerts** - Risk of sending same alert multiple times
4. **Stale data** - Old prices being used for display or evaluation
5. **Weak observability** - Insufficient logging and metrics for operational visibility
6. **Documentation misalignment** - Docs don't match actual runtime behavior
7. **Weak message design** - Unclear user-facing messages
8. **Non-standard price display** - Inconsistent price formatting
9. **Over-development risk** - Adding features before core is stable

## Phase 0 — Contract Freeze (1 week)

### Goals

Create source of truth contracts for all subsequent work. Establish clear definitions before implementation.

### Deliverables

- **Asset Identity Policy** (T-001): Standard naming, display names, symbols, aliases, canonical IDs
- **Pricing Presentation Policy** (T-002): Toman as primary unit, rounding rules, decimal places, thousand separators
- **Alert Flow Contract** (T-003): Step-by-step flow with stages, inputs, outputs, error paths, confirmation points
- **Alert Lifecycle Contract** (T-004): Formal states (active, triggered, notifying, notified, completed, cancelled, failed)
- **Freshness Policy** (T-005): Thresholds for fresh/delayed/stale/unavailable data

### Acceptance Criteria

- Single definition exists for asset naming
- Single definition exists for price display
- Reference alert flow is documented and agreed upon
- Alert lifecycle is formally defined
- Freshness policy is specified and documented

### Risks & Mitigation

- **Risk**: Lengthy discussions without final decisions
- **Mitigation**: Time-boxed decision making, Tech Lead/Product final freeze, limited unresolved items

## Phase 1 — UX Flow Stabilization (1-1.5 weeks)

### Goals

Remove ambiguity from alert creation experience. Make flow step-based, explicit, and predictable.

### Deliverables

- **Step-based Alert Flow** (T-101): Asset selection → Price display → Condition selection → Target price → Summary → Confirmation
- **Asset Selection Messages** (T-102): Show display name + symbol, explicit confirmation
- **Price Entry Messages** (T-103): Explicit unit, input examples, actionable errors
- **Final Confirmation Template** (T-104): Asset, condition, target price, unit, current price
- **Error Messages** (T-105): Clear, actionable error messages

### Acceptance Criteria

- User makes only one main decision per step
- Selected asset is visible at all sensitive points
- No final registration without standard confirmation
- Messages are implementable by backend team

### Dependencies

- Phase 0 contracts must be frozen

### Risks & Mitigation

- **Risk**: Flow becomes too long
- **Mitigation**: One decision per step, demo on real scenario, focus on clarity

## Phase 2 — Backend Hardening (2 weeks)

### Goals

Convert reference flow and lifecycle to reliable runtime logic. Prevent duplicate alerts and ensure state consistency.

### Deliverables

- **Canonical Asset Model** (T-201): Unique internal IDs, provider mapping, eliminate raw provider dependencies
- **User Flow State Machine** (T-202): Explicit states, reject invalid transitions, clear cancel/reset
- **Alert Lifecycle Implementation** (T-203): States in persistence/runtime, auditable transitions, event timestamps
- **Trigger Idempotency** (T-204): Single final path for alert+trigger event, logical duplicate suppression
- **Atomic Claim/Locking** (T-205): Temporary ownership for evaluation/trigger, timeout/release behavior
- **Retry Policy** (T-206): Safe retry for fetch/evaluate/send with idempotency protection
- **Race Condition Tests** (T-207): Test concurrent scenarios

### Acceptance Criteria

- Invalid transitions are rejected
- Duplicate trigger is logically suppressed
- Concurrent workers cannot finalize same alert
- Alert states are traceable

### Dependencies

- Phase 1 flow design complete

### Risks & Mitigation

- **Risk**: Complex data migration
- **Mitigation**: Feature flag/controlled rollout, test on existing data, backward compatibility plan

## Phase 3 — Freshness Logic & Observability (1.5-2 weeks)

### Goals

Make price logic trustworthy and system behavior observable.

### Deliverables

- **Freshness Classification** (T-301): Compute fresh/delayed/stale/unavailable status
- **Freshness in Display** (T-302): Add freshness context to sensitive price displays
- **Freshness in Trigger Logic** (T-303): Define trigger behavior for stale/unavailable
- **Edge Case Tests** (T-304): Test very small/large prices, stale/delayed scenarios
- **Structured Log Schema** (T-401): Standard key fields, consistent naming, event types
- **Key Event Logs** (T-402): create/evaluate/trigger/send/failure/retry with alert_id
- **Base Metrics** (T-403): Alert, notification, stale data, queue, failure metrics
- **Correlation** (T-404): Trace alert_id → job → send attempt
- **Operational Alerting** (T-405): Internal alerts for provider outage, worker backlog, stale spike
- **Incident Runbooks** (T-406): Runbooks for duplicate alert, stale data spike, provider outage, worker backlog, send failure

### Acceptance Criteria

- Stale data doesn't trigger without defined logic
- Key events are logged
- Critical metrics are visible
- Incident tracing is possible

### Dependencies

- Phase 2 lifecycle implementation complete

### Risks & Mitigation

- **Risk**: Too much non-actionable observability
- **Mitigation**: Only high-value events, limited actionable metrics, configurable thresholds

## Phase 4 — QA, Audit, Release Readiness (1-1.5 weeks)

### Goals

Convert hardened version to trustworthy release.

### Deliverables

- **Test Matrix** (T-501): End-to-end test matrix for happy path, input error, stale data, duplicate prevention, failure path
- **Real Walkthrough** (T-502): Execute 5+ real scenarios from user and operations perspective
- **Documentation Audit** (T-503): Align key docs with runtime behavior
- **Release Checklist** (T-504): Final checklist for hardened release

### Acceptance Criteria

- Main failure modes are tested
- Operational runbooks are ready
- Pre-release checklist complete
- Important mismatches are closed or explicit

### Dependencies

- Phase 3 observability complete

### Risks & Mitigation

- **Risk**: Late architecture problem discovery
- **Mitigation**: Early blocker escalation, real walkthrough near-production, limited incident simulation

## Sprint Plan (6-8 weeks total)

### Sprint 1: Contract Freeze (Week 1)
- Tasks: T-001, T-002, T-003, T-004, T-005
- Milestone M1: Contract Freeze Complete

### Sprint 2: UX Flow Stabilization (Week 2)
- Tasks: T-101, T-102, T-103, T-104, T-105
- Milestone M2: UX Flow Approved

### Sprint 3: Backend Hardening (Weeks 3-4)
- Tasks: T-201, T-202, T-203, T-204, T-205, T-206, T-207
- Milestone M3: Core Runtime Hardened

### Sprint 4: Freshness & Observability (Weeks 5-6)
- Tasks: T-301, T-302, T-303, T-304, T-401, T-402, T-403, T-404, T-405, T-406
- Milestone M4: Observable & Freshness-Aware System

### Sprint 5: QA & Release Readiness (Week 7)
- Tasks: T-501, T-502, T-503, T-504
- Milestone M5: Release Ready Hardening Build

## Key Performance Indicators (KPIs)

### Product/UX KPIs
- **KPI-1**: Alert Creation Completion Rate - Increase from baseline
- **KPI-2**: Alert Creation Error Rate - Significant decrease
- **KPI-3**: User Correction Rate Before Final Confirmation - Reasonable rate indicates useful confirmation

### Reliability KPIs
- **KPI-4**: Duplicate Alert Trigger Rate - Near zero
- **KPI-5**: Duplicate Notification Send Rate - Near zero
- **KPI-6**: Invalid State Transition Rate - Zero or near zero

### Data Quality KPIs
- **KPI-7**: Stale Data Evaluation Rate - Controlled and explainable
- **KPI-8**: Trigger Blocked by Freshness Policy - Monitor for provider issues vs policy effectiveness

### Operational KPIs
- **KPI-9**: Worker Processing Latency - Low and stable
- **KPI-10**: Notification Send Failure Rate - Low and controllable
- **KPI-11**: Incident Detection Time - Continuous decrease
- **KPI-12**: Mean Time to Recovery (MTTR) - Continuous decrease

## Go/No-Go Gates for Release

Before full rollout, these must pass:
- Duplicate trigger rate near zero in testing/initial rollout
- No critical invalid transitions observed
- Alert creation happy path stable
- Stale data behavior matches defined policy
- create/evaluate/trigger/send events are traceable
- Main incident runbooks are ready

## Risk Register

### R-01: Ambiguity in Contracts (High severity, Medium probability)
- **Impact**: Misdirects redesign and development
- **Signs**: UX/backend disagreement, repeated discussions, many exceptions
- **Response**: Contract freeze, specific owner, time-boxed decisions
- **Owner**: Product + Tech Lead

### R-02: Over-complex Alert Flow (High severity, Medium probability)
- **Impact**: High user drop-off
- **Signs**: Many steps, long messages, frequent back-navigation
- **Response**: One decision per step, demo on real scenario, limit branches
- **Owner**: UX/Content + Product

### R-03: Incomplete Asset Identity Migration (High severity, Medium probability)
- **Impact**: Existing alerts or mappings become inconsistent
- **Signs**: Asset mismatch, different behavior for old data
- **Response**: Migration plan, backfill, audit on old data
- **Owner**: Backend + Tech Lead

### R-04: Duplicate Trigger with Incomplete Changes (Very High severity, Medium probability)
- **Impact**: Direct damage to user trust
- **Signs**: Repeated triggers, double sends, worker races
- **Response**: Idempotency + atomic claim + race scenario tests
- **Owner**: Backend

### R-05: Inappropriate Freshness Policy (High severity, Medium probability)
- **Impact**: Either miss real triggers or fire wrong ones
- **Signs**: Many blocks, suspicious triggers, time mismatch
- **Response**: Configurable thresholds, phased tuning, monitoring
- **Owner**: Tech Lead + Backend

### R-06: Insufficient Observability (High severity, High probability)
- **Impact**: Incidents detected late
- **Signs**: Unable to trace, vague logs, useless dashboard
- **Response**: Unified schema, limited key events, actionable metrics
- **Owner**: Ops/Infra + Backend

### R-07: Document/Runtime Misalignment (Medium-High severity, High probability)
- **Impact**: Team decides based on incorrect reality
- **Signs**: Real behavior differs from doc, QA finds unexpected
- **Response**: Walkthrough, doc audit, specific source of truth
- **Owner**: Tech Lead + Product

### R-08: Scope Creep During Hardening (High severity, High probability)
- **Impact**: Focus shifts from reliability to minor features
- **Signs**: New non-essential requests, continuous backlog changes
- **Response**: Scope freeze, explicit out-of-scope definition
- **Owner**: Product

### R-09: Insufficient QA on Edge Cases (High severity, Medium probability)
- **Impact**: Problems only seen in production
- **Signs**: Heavy happy path coverage, light failure path coverage
- **Response**: Mandatory test matrix, race/failure scenarios, real walkthrough
- **Owner**: QA

### R-10: Alert Fatigue in Internal Monitoring (Medium severity, Medium probability)
- **Impact**: Real alerts ignored
- **Signs**: Many low-value alerts, muted alerts
- **Response**: Threshold tuning, severity tiering, periodic review
- **Owner**: Ops/Infra

## Go-Live Strategy

### Phased Rollout
1. Enable in staging with full walkthrough
2. Limited internal rollout
3. Controlled user subset rollout
4. Monitor key KPIs
5. General rollout

### Rollout Stop Criteria
Pause rollout if:
- Duplicate notification observed
- Critical invalid transition occurs
- Stale policy causes unexplained behavior
- Send failure rate exceeds threshold
- Unusual worker backlog

## Phase After Hardening — Product Expansion

Only after reliability is stable (evidenced by no duplicate sends, no stale-data triggers, no invalid critical transitions, sufficient observability):

### Candidate Work
- Pause/resume alerts in Telegram
- Edit target/condition after activation with re-confirmation
- Recurring alerts with cooldown
- More assets and provider integrations
- Provider health dashboard
- Alert history and user-facing delivery status
- Mini App or web dashboard for alert management

## Success Definition

This hardening program succeeds when at completion:

- Alert creation flow is no longer ambiguous
- Asset and price are explicit at all sensitive points
- Duplicate trigger/send is meaningfully suppressed
- Stale data has defined and defensible behavior
- Main incidents are detectable and traceable
- Team doesn't view docs and runtime as different realities
- Next release builds on a trustworthy core, not ambiguous behavior
