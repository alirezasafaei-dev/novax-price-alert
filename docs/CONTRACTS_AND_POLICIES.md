# Contracts and Policies (from PROJECT_IMPROVEMENT_REPORT_FA)

**Source:** Distilled from the 6-part improvement report. These are the living source of truth for explicit behavior. Reference in code, tests, and runtime.

## 1. Asset Identity Policy (T-001)
- Every asset has:
  - Internal canonical ID (unique, stable).
  - Display name (e.g., "بیت‌کوین (BTC)").
  - Symbol (e.g., "BTC_USDT").
  - Unit (تومان for Iranian market assets, USDT for crypto where market convention).
  - Mapping to providers (Binance, TGJU, etc.).
- Aliases supported in controlled way (e.g., "دلار" -> "USD_IRT").
- In all flows (creation, alerts, notifications, TWA): always use display name + symbol + unit explicitly. Never implicit.
- Storage: canonical_asset_id in alert_rules and snapshots at creation time.

## 2. Pricing Presentation Policy (T-002)
- Primary unit for Iranian users: **تومان** (IRT).
- Crypto: USDT only where that is actual market convention (e.g., BTC_USDT).
- Format:
  - Readable with thousand separators.
  - Appropriate decimals (avoid too many for expensive assets, avoid tiny for cheap).
  - Show timestamp / freshness.
- Never show raw API values without formatting.
- In alerts, confirmations, lists, TWA, history: consistent unit + format.
- Exceptions documented (e.g., for very small/large prices).

## 3. Alert Flow Contract (T-003)
- Mandatory staged flow (one decision per stage):
  1. Select asset (explicit display name + symbol + unit).
  2. Show current price (with freshness).
  3. Select condition (ABOVE / BELOW).
  4. Enter target price (with unit and example).
  5. Show full summary (asset, condition, target, unit, current).
  6. Explicit confirm (no auto-activate).
- State machine: DRAFT -> AWAITING_CONDITION -> AWAITING_TARGET_PRICE -> PENDING_CONFIRMATION -> ACTIVE (only after confirm).
- Cancel/ back always available.
- Errors actionable with examples.
- Confirmation must repeat asset + condition + target + unit.

## 4. Alert Lifecycle Contract (T-004)
- Official states and valid transitions (see domain/alert_rule.py VALID_TRANSITIONS):
  - DRAFT, AWAITING_*, PENDING_CONFIRMATION, ACTIVE, TRIGGERED, DELIVERY_IN_PROGRESS, DELIVERED, PAUSED, CANCELLED, FAILED.
- is_active only true for ACTIVE.
- Timestamps: confirmed_at, triggered_at, delivered_at, cancelled_at, failed_at.
- Transition always validated; invalid -> error + metric + event.
- Events logged with alert_id, user_id, etc.

## 5. Freshness Policy (T-005)
- Thresholds (configurable in services/freshness.py):
  - fresh: < 10min (default)
  - stale: 10-30min
  - unavailable: >30min or >2h or no data
- Classification in classify_latest_price.
- Behavior:
  - Display: always show freshness indicator + last observed time (never pretend fresh).
  - Evaluation/Trigger: only on FRESH (evaluation_allowed == true). Block or defer otherwise. Emit stale_data_detected.
- Provider can mark is_stale.
- In responses: include freshness field.
- Monitoring: count stale/unavailable in metrics.

**Implementation notes:** Policies enforced in code (evaluator, crud, query services, TWA). Any change requires update here + tests + docs.

**Last updated:** Per auto-execution of roadmap.
