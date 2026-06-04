# Implementation Roadmap

This roadmap is the active execution plan for the current Telegram price-alert bot. It encodes the product, UX, technical, and operational hardening guidance that is already reflected in the current codebase.

## خلاصه فارسی

این سند مسیر فازبندی شده و قابل اجرا را برای تبدیل بات قیمت تلگرام به یک محصول قابل اعتماد و پشتیبانی‌شدنی تعریف می‌کند.

- فاز ۰: ثابت کردن وضعیت فعلی مستندات و جلوگیری از وابستگی به drafts/آرشیو.
- فاز ۱: شفاف کردن جریان ساخت هشدار، نمایش دارایی و واحد قیمت.
- فاز ۲: سخت‌سازی reliability با جلوگیری از duplicate notification، stale data و state transitions نامشخص.
- فاز ۳: اضافه کردن دید عملیاتی، مانیتورینگ cron و runbook incident.
- فاز ۴: بهبودهای تولید و گسترش غنی رابط کاربری و قابلیت‌ها (بدون محدودیت MVP).

این roadmap طوری نوشته شده که هم agent خودکار بتواند به‌صورت مرحله‌ای کار کند و هم تیم فنی بتواند آن را به ticket/PR تبدیل کند.

## Core hardening findings

- The product is defined for real Iranian Telegram users, not a demonstration MVP.
- The main display unit for users is **تومان**. Crypto prices are shown in **USDT** only where that is the actual market convention.
- Alert creation must be explicit, confirm-gated, and summary-first.
- Asset identity must be canonical and unambiguous across flow, storage, and notifications.
- Stale or unavailable data must not trigger alerts.
- Duplicate notification behavior is a production incident, not a benign retry.
- Observability and operational readiness are baseline requirements, not optional extras.

Background: earlier review work produced a six-part improvement series, and this roadmap distills those findings into a single living plan.

- Report 01 establishes the mission: a real Iranian Telegram price-alert bot, not an MVP demo. It emphasizes alignment of product, UX, and code to real user needs.
- Report 02 analyzes the key risks: asset-selection ambiguity, alert-flow ambiguity, duplicate notifications, stale data, observability gaps, and mismatched docs.
- Report 03 turns those risks into practical execution guidance across product, UX, technical, and operational layers.
- Reports 04–06 provide deeper tactical detail on alert lifecycle hardening, data freshness guards, delivery idempotency, and operational readiness.
- The roadmap distills that series into a short active execution plan while keeping the full reports available for reference.

## Execution Plan for Automation and Engineering

This section defines the executable phase plan for both an automated agent and a full-stack / senior engineering team.

- هر فاز با یک هدف مشخص آغاز می‌شود.
- هر تسک باید به صورت `- [ ]` نوشته شود تا agent بتواند آن را علامت بزند.
- پذیرش هر فاز با شرایط پذیرش روشن شده است.

### چک‌لیست کلی فازها

- [x] Phase 0: Baseline Freeze
- [x] Phase 1: UX Clarity
- [x] Phase 2: Reliability Hardening
- [x] Phase 3: Observability and Operations
- [x] Phase 4: Controlled Expansion

## Goal

Make the current Telegram bot and Telegram Mini App stack more reliable, more explicit, and easier to maintain without expanding scope unnecessarily.

## Guiding Principles

- Keep the bot menu-driven and simple.
- Treat alert confirmation as mandatory.
- Keep canonical asset identity and explicit units everywhere.
- Prefer reliability and observability over new surface area.
- Keep active docs short; keep retired drafts separate from the living docs.

## Phase 0: Baseline Freeze

### Objective

Lock the current behavior as the reference baseline.

### Deliverables

- active docs aligned with code
- historical review work retained separately, while active docs remain authoritative
- production facts documented in `PROGRESS.md`

### Tasks

- [ ] verify `README.md`, `AGENTS.md`, `INDEX.md`, and `MEMORY.md`
- [ ] keep the active docs set short
- [ ] move retired phase-specific drafts to a separate history location
- [ ] confirm no active doc links to retired drafts or archive paths
- [ ] mark this phase complete when all active docs are aligned and checked in

### Acceptance

- a new agent can find the source of truth in under 2 minutes
- no active doc contradicts the codebase reality

### Task Breakdown

| Task                                       | Owner         | Output                                                  | Acceptance                                             |
| ------------------------------------------ | ------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Freeze active docs list                    | Tech Lead     | `docs/README.md`, `INDEX.md`, `MEMORY.md` aligned       | no duplicate source-of-truth paths                     |
| Retain retired review work as history only | Docs owner    | historical review work kept outside the active docs set | active docs do not depend on retired drafts as current |
| Verify production facts                    | Backend + Ops | `PROGRESS.md` matches runtime reality                   | no statement in `PROGRESS.md` conflicts with code      |

## Phase 1: UX Clarity

### Objective

Remove ambiguity from price display and alert creation.

### Deliverables

- explicit asset labels in all sensitive flows
- staged alert flow with clear summary and confirm step
- consistent terminology for units and prices

### Tasks

- [x] keep the alert wizard step-based
- [x] ensure target price and unit are always visible in every alert creation step
- [x] keep delete/list flows easy to understand
- [x] verify confirmation text displays asset, condition, unit, and target price
- [x] update live docs to reflect the current alert flow and wording

### Acceptance

- a user can create an alert without guessing the target asset or unit
- summary and confirmation show the same asset and unit the code stores

### Task Breakdown

| Task                             | Owner                | Output                                  | Acceptance                                              |
| -------------------------------- | -------------------- | --------------------------------------- | ------------------------------------------------------- |
| Standardize asset naming         | Product + UX/Content | explicit asset labels in flows          | no sensitive message uses ambiguous asset-only text     |
| Standardize target unit language | Product + Backend    | `toman`/`USDT` conventions documented   | display and stored unit match                           |
| Harden confirmation summary      | UX/Content + Backend | summary template for alert confirm step | user sees asset, condition, unit, target, current price |
| Simplify list/delete flow        | UX/Content           | easy alert list + delete experience     | user can inspect and delete without confusion           |

## Phase 2: Reliability Hardening

### Objective

Protect the system from duplicate alerts, stale data, and ambiguous state transitions.

### Deliverables

- canonical asset identity in the data model
- lifecycle-gated alerts
- idempotent notification delivery
- freshness-aware trigger behavior

### Tasks

- [x] keep alert state transitions explicit and validated
- [x] keep stale/unavailable data from triggering notifications
- [x] keep send retries from creating duplicate user-visible events
- [x] add or verify tests for duplicate prevention and stale-data gates
- [x] review alert lifecycle coverage in current code and tests

### Acceptance

- duplicate send is treated as an incident
- stale data never produces a false trigger
- confirmed alerts remain traceable through logs and state

### Task Breakdown

| Task                             | Owner               | Output                                   | Acceptance                                      |
| -------------------------------- | ------------------- | ---------------------------------------- | ----------------------------------------------- |
| Enforce canonical asset identity | Backend             | canonical ids in alert and asset records | evaluations use canonical ids, not display text |
| Validate state transitions       | Backend + Tech Lead | explicit alert lifecycle checks          | invalid transitions are rejected                |
| Add idempotency to delivery      | Backend             | single-send guarantee per event          | duplicate send cannot happen for same event     |
| Block stale triggers             | Backend + Ops       | freshness gate in evaluation             | stale/unavailable prices do not fire alerts     |

## Phase 3: Observability and Operations

### Objective

Make runtime health visible and supportable.

### Deliverables

- structured log contract
- cron heartbeat monitor
- runbook for incident handling
- deploy/release checklist

### Tasks

- [x] watch `alert_evaluated`, `notification_send_*`, and `stale_data_detected`
- [x] keep `/status` monitored from outside the Worker
- [x] keep `/health` and `/api/v1/prices/latest` in release checks
- [x] document the incident response path for duplicate send, stale data, and relay failure
- [x] verify runbook references are up to date in `docs/OPERATIONS.md` or `docs/OBSERVABILITY.md`

### Acceptance

- operators can tell whether cron is healthy
- operators can trace an alert from creation to delivery
- a rollout can be paused using logs and health endpoints

### Task Breakdown

| Task                         | Owner           | Output                               | Acceptance                                                     |
| ---------------------------- | --------------- | ------------------------------------ | -------------------------------------------------------------- |
| Keep log contract stable     | Backend + Ops   | structured event names and fields    | alert trace can be reconstructed from logs                     |
| Keep cron heartbeat external | Ops             | GitHub Actions monitor and `/status` | stale cron is detected outside Worker                          |
| Define incident playbooks    | Ops             | short operational response notes     | duplicate send, stale data, and relay failure have clear steps |
| Keep release checks short    | Tech Lead + Ops | deploy checklist                     | every release uses the same health gates                       |

## Phase 4: Production Enhancements & Rich UX (Full Product Focus)

### Objective

Deliver the best possible user experience and functionality for a real production Iranian Telegram price-alert product. No MVP limitations, nice-to-haves, or artificial "controlled" brakes. Prioritize ambitious, high-impact improvements to UI/UX (TWA as full mini-app + enriched bot chat), functionality (smart suggestions, My Assets as first-class, advanced charting, richer interactions), while maintaining the hardened core.

### Key Principles (Updated)

- Treat as full production product from day one.
- UI/UX and end-user value are top priority alongside reliability.
- Bold expansions: richer interfaces, smarter features, better asset coverage, seamless bot <-> TWA integration.
- Every improvement must be high-quality, well-tested, and observable.
- Roadmap is living; new phases for ongoing innovation (e.g. AI suggestions, multi-asset portfolios, notifications 2.0).

### Current Focus Areas (Best Possible Work)

- **UI/UX Overhaul**:
  - TWA as a polished, navigable mini-app (tabs/sections: Prices, My Assets, Alerts, Create, Charts).
  - Interactive advanced charts (time ranges, comparisons, sparklines).
  - Smart "Suggestions" and "My Assets" as core experiences with quick actions.
  - Enriched bot chat: asset browser, inline suggestions, deep links to TWA.
- **Functionality**:
  - My Assets: full watchlist view, performance summary, bulk actions.
  - Smart suggestions: based on volatility, user history, market moves, complementary assets.
  - Advanced alerts: more conditions, trailing, multi-asset.
  - Better discovery: search, categories, trends.
- **Expansion**:
  - More assets/markets with quality providers.
  - Richer notifications and summaries in bot.
  - Operational polish for scale.

### Tasks (Ambitious & Ongoing)

- [ ] Full TWA navigation and app-like experience (tabs, better flows, Telegram WebApp APIs).
- [ ] Advanced charting and visualization in TWA (ranges, multi-asset, trends).
- [ ] First-class My Assets experience with summaries, quick-edit, favorites.
- [ ] Intelligent Suggestions engine (volatility-based, personalized, in both bot and TWA).
- [ ] Enrich bot chat UX (asset quick views, suggestion carousels, one-tap actions).
- [ ] Expand assets with robust testing and user-facing discovery.
- [ ] Advanced alert features (trailing stops, conditions, bulk management).
- [ ] Continuous UX polish, performance, accessibility for Iranian users.

### Acceptance (Full Product)

- Improvements deliver clear, measurable value to real users (better engagement with alerts, discovery).
- No regression in core reliability/hardening.
- UI/UX feels premium and native to Telegram + web.
- Features are ambitious but maintainable and observable.

### Task Breakdown (Examples)

| Task                              | Owner                | Output                     | Acceptance                                  |
| --------------------------------- | -------------------- | -------------------------- | ------------------------------------------- |
| TWA as full mini-app             | UX + Backend        | Tabbed navigation, rich components | Users can fluidly browse prices/assets/alerts/create without friction |
| Advanced charts + My Assets      | Backend + UX        | Time-range charts, asset summaries | My Assets shows value + actions; charts are interactive and useful |
| Smart Suggestions                | Product + Backend   | Volatility + history based recs | Suggestions appear in TWA and bot, lead to higher alert creation |
| Enriched bot chat UX             | Worker + UX         | Inline asset views, suggestion buttons | Chat feels modern, reduces need to open TWA for simple tasks |

## Milestone Checklist

- [x] Milestone A: active docs aligned and baseline behavior frozen
- [x] Milestone B: alert flow explicit and confirm-gated
- [x] Milestone C: duplicate prevention and stale-data protection stable
- [x] Milestone D: observability and ops runbooks usable in production

## How to Use This File

- Use it as the execution layer together with `PROGRESS.md` and the live docs.
- Turn each task into a ticket or PR and mark it with `[x]` when done.
- For automated agents: complete the checklist items in order and only proceed if acceptance criteria are met.
- Do not add new features before the current phase is accepted.
