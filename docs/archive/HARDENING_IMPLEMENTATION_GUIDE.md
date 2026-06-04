# Hardening Implementation Guide

This guide provides practical instructions for executing the hardening plan outlined in the ROADMAP.md based on the Persian improvement report.

## Quick Reference

- **Total Duration**: 6-8 weeks
- **Sprints**: 5 sprints (1-2 weeks each)
- **Primary Focus**: Reliability, clarity, observability over new features
- **Market**: Iranian users with Toman as primary unit

## Phase 0: Contract Freeze (Week 1)

### Task T-001: Asset Identity Policy

**Objective**: Define how assets are named, stored, and displayed.

**Actions**:
1. List all current assets in the system
2. Define standard format: `{Display Name} ({Symbol})`
3. Create canonical ID scheme (e.g., `btc`, `usdt`, `gold_18k`, `usd_free`)
4. Document allowed aliases
5. Define provider mapping strategy

**Output Document**: `docs/ASSET_IDENTITY_POLICY.md`

**Example**:
```
Display Name: بیت‌کوین
Symbol: BTC
Canonical ID: btc
Aliases: bitcoin, BTC
Provider Mapping: 
  - nerkh.ir: bitcoin
  - binance: BTC
```

---

### Task T-002: Pricing Presentation Policy

**Objective**: Define how prices are displayed to users.

**Actions**:
1. Establish Toman (تومان) as primary unit
2. Define rounding rules (e.g., no decimals for Toman)
3. Set thousand separator (comma for Persian context)
4. Define when to show reference price (USD)
5. Handle edge cases (very small/large numbers)

**Output Document**: `docs/PRICING_PRESENTATION_POLICY.md`

**Example**:
```
Primary Unit: تومان
Decimal Places: 0
Thousand Separator: ,
Format: 1,234,567 تومان
Reference Display: Secondary, in parentheses
Edge Cases:
  - < 1000 Toman: Show full number
  - > 1B Toman: Consider alternative units
```

---

### Task T-003: Alert Flow Contract

**Objective**: Document the step-by-step alert creation process.

**Actions**:
1. Map current alert flow
2. Identify ambiguity points
3. Design step-based flow:
   - Step 1: Asset selection
   - Step 2: Current price display
   - Step 3: Condition selection (above/below)
   - Step 4: Target price entry
   - Step 5: Summary display
   - Step 6: Final confirmation
4. Define error paths
5. Define cancellation paths

**Output Document**: `docs/ALERT_FLOW_CONTRACT.md`

**Flow Diagram**:
```
User: /alert
Bot: "کدام دارایی را می‌خواهید رصد کنید؟"
User: [Selects Bitcoin]
Bot: "قیمت فعلی بیت‌کوین (BTC): 3,500,000,000 تومان"
Bot: "می‌خواهید وقتی قیمت بالاتر رفت هشدار بگیرید یا پایین‌تر آمد؟"
User: [Selects "بالاتر"]
Bot: "قیمت هدف را به تومان وارد کنید (مثال: 4,000,000,000)"
User: [Enters price]
Bot: [Shows summary with asset, condition, target, unit]
Bot: [Confirm/Edit/Cancel buttons]
```

---

### Task T-004: Alert Lifecycle Contract

**Objective**: Define formal states for alerts.

**Actions**:
1. Define state enum:
   - `active`: Alert is active and waiting for trigger
   - `triggered`: Condition met, preparing to notify
   - `notifying`: Notification in progress
   - `notified`: Successfully sent
   - `completed`: Alert finished (one-time) or disabled
   - `cancelled`: User cancelled
   - `failed`: Error occurred
2. Define valid transitions
3. Define event timestamps (triggered_at, notified_at, etc.)

**Output Document**: `docs/ALERT_LIFECYCLE_CONTRACT.md`

**State Diagram**:
```
[active] → [triggered] → [notifying] → [notified] → [completed]
   ↓
[cancelled]
   ↓
[failed]
```

---

### Task T-005: Freshness Policy

**Objective**: Define when data is considered fresh, delayed, stale, or unavailable.

**Actions**:
1. Define thresholds:
   - `fresh`: < 30 seconds old
   - `delayed`: 30-120 seconds old
   - `stale`: > 120 seconds old
   - `unavailable`: No data or error
2. Define behavior for each state:
   - Display: Show freshness indicator
   - Trigger: Block or defer for stale/unavailable
3. Make thresholds configurable

**Output Document**: `docs/FRESHNESS_POLICY.md`

**Example**:
```
Fresh (< 30s): Normal display, allow trigger
Delayed (30-120s): Show "آخرین به‌روزرسانی: X ثانیه قبل", allow trigger
Stale (> 120s): Show "قیمت به‌روز نیست", block trigger
Unavailable: Show "داده در دسترس نیست", block trigger
```

---

## Phase 1: UX Flow Stabilization (Week 2)

### Task T-101: Step-based Alert Flow

**Implementation**:
1. Update Cloudflare Worker `alert-flow.js` to implement state machine
2. Create separate handlers for each step
3. Store step state in KV session
4. Add step transition validation

**Code Location**: `deploy/cloudflare-worker/src/alert-flow.js`

---

### Task T-102: Asset Selection Messages

**Implementation**:
1. Update message templates in `keyboards.js`
2. Ensure format: `{Display Name} ({Symbol})`
3. Add confirmation after selection
4. Update asset catalog in `asset-catalog.js`

**Example Message**:
```
"دارایی انتخاب‌شده: بیت‌کوین (BTC)"
```

---

### Task T-103: Price Entry Messages

**Implementation**:
1. Add explicit unit to prompt
2. Include valid input examples
3. Improve error messages to be actionable

**Example Messages**:
```
Prompt: "قیمت هدف را به تومان وارد کنید (مثال: 4,000,000,000)"
Error: "قیمت واردشده قابل تشخیص نیست. لطفاً عدد را به تومان و بدون متن اضافی وارد کنید."
```

---

### Task T-104: Final Confirmation Template

**Implementation**:
1. Create summary message template
2. Include: asset name, condition, target price, unit, current price
3. Add Confirm/Edit/Cancel buttons

**Example**:
```
"هشدار شما برای بیت‌کوین (BTC) در حال ثبت است"
"شرط: اگر قیمت به بالاتر از 4,000,000,000 تومان برسد"
"قیمت فعلی: 3,500,000,000 تومان"
[ثبت] [ویرایش] [لغو]
```

---

## Phase 2: Backend Hardening (Weeks 3-4)

### Task T-201: Canonical Asset Model

**Implementation**:
1. Update `src/novax_price_alert/db/models.py` Asset model
2. Add `canonical_id` field
3. Create migration script
4. Update asset catalog with canonical IDs

**Model Changes**:
```python
class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True)
    canonical_id = Column(String(50), unique=True, nullable=False)  # New
    display_name = Column(String(100), nullable=False)
    symbol = Column(String(20), nullable=False)
    # ... other fields
```

---

### Task T-202: User Flow State Machine

**Implementation**:
1. Define flow states in Worker
2. Implement transition validation
3. Add cancel/reset handlers

**States**:
```javascript
const FLOW_STATES = {
  SELECTING_ASSET: 'selecting_asset',
  VIEWING_PRICE: 'viewing_price',
  SELECTING_CONDITION: 'selecting_condition',
  ENTERING_TARGET: 'entering_target',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};
```

---

### Task T-203: Alert Lifecycle Implementation

**Implementation**:
1. Update Alert model with state field
2. Add timestamp fields
3. Implement transition logic in backend
4. Add state change logging

**Model Changes**:
```python
class Alert(Base):
    # ... existing fields
    state = Column(String(20), default='active')
    triggered_at = Column(DateTime, nullable=True)
    notifying_at = Column(DateTime, nullable=True)
    notified_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
```

---

### Task T-204: Trigger Idempotency

**Implementation**:
1. Add `last_trigger_event_id` to Alert model
2. Check before processing trigger
3. Log duplicate prevention

**Logic**:
```python
def process_trigger(alert, price, event_id):
    if alert.last_trigger_event_id == event_id:
        logger.info(f"Duplicate trigger prevented for alert {alert.id}")
        return
    
    alert.last_trigger_event_id = event_id
    # ... process trigger
```

---

### Task T-205: Atomic Claim/Locking

**Implementation**:
1. Add `claimed_at` and `claimed_by` fields
2. Implement claim logic with timeout
3. Add release on completion/failure

**Logic**:
```python
def claim_alert(alert_id, worker_id):
    alert = db.get_alert(alert_id)
    if alert.claimed_at and (now - alert.claimed_at) < CLAIM_TIMEOUT:
        return False  # Already claimed
    
    alert.claimed_at = now
    alert.claimed_by = worker_id
    db.save(alert)
    return True
```

---

## Phase 3: Freshness & Observability (Weeks 5-6)

### Task T-301: Freshness Classification

**Implementation**:
1. Create freshness calculator utility
2. Integrate with price service
3. Add freshness to price responses

**Utility**:
```python
def get_freshness_status(price_timestamp):
    age = now - price_timestamp
    if age < timedelta(seconds=30):
        return 'fresh'
    elif age < timedelta(seconds=120):
        return 'delayed'
    elif age < timedelta(seconds=300):
        return 'stale'
    else:
        return 'unavailable'
```

---

### Task T-401: Structured Log Schema

**Implementation**:
1. Define standard log fields
2. Create logging utility
3. Apply to all key events

**Standard Fields**:
```python
{
    'timestamp': ISO8601,
    'event_type': str,
    'alert_id': int,
    'user_id': int,
    'asset_id': str,
    'job_id': str,
    'worker_id': str,
    'status': str,
    'reason': str,
    'metadata': dict
}
```

---

### Task T-402: Key Event Logs

**Implementation**:
1. Add logs for: create, evaluate, trigger, send, failure, retry
2. Ensure alert_id and event_type in all logs
3. Test log queryability

**Events**:
```python
log_alert_created(alert_id, user_id, asset_id, condition, target)
log_alert_evaluated(alert_id, current_price, condition_met)
log_alert_triggered(alert_id, price, event_id)
log_notification_send_started(alert_id, user_id)
log_notification_send_succeeded(alert_id)
log_notification_send_failed(alert_id, error)
```

---

### Task T-403: Base Metrics

**Implementation**:
1. Define metric names and types
2. Implement metric emission
3. Set up dashboard (if available)

**Metrics**:
```python
metrics.alert_create_success_rate
metrics.alert_evaluation_count
metrics.trigger_count
metrics.notification_success_rate
metrics.duplicate_prevented_count
metrics.stale_price_count
metrics.provider_error_rate
metrics.queue_backlog
metrics.worker_failure_rate
metrics.processing_latency
```

---

## Phase 4: QA & Release Readiness (Week 7)

### Task T-501: Test Matrix

**Test Scenarios**:
1. Happy path: Create alert, trigger, receive notification
2. Input error: Invalid price, invalid asset
3. Stale data: Alert with stale price
4. Duplicate prevention: Concurrent evaluation
5. Failure path: Provider error, send failure

**Document**: `tests/TEST_MATRIX.md`

---

### Task T-502: Real Walkthrough

**Scenarios to Execute**:
1. Create alert for Bitcoin (above condition)
2. Create alert for Tether (below condition)
3. Create alert with invalid input
4. Wait for trigger (if possible in test environment)
5. Check logs for all events
6. Verify no duplicate sends

---

### Task T-503: Documentation Audit

**Checklist**:
- [ ] Alert flow matches actual bot behavior
- [ ] Asset naming is consistent
- [ ] Price display follows policy
- [ ] Lifecycle states match implementation
- [ ] Freshness behavior is documented
- [ ] Error messages are accurate

---

### Task T-504: Release Checklist

**Pre-Release**:
- [ ] All P0 tasks completed
- [ ] Test matrix passed
- [ ] Walkthrough completed
- [ ] Documentation aligned
- [ ] Runbooks ready
- [ ] Metrics dashboard set up

**Post-Release**:
- [ ] Monitor for 24 hours
- [ ] Check for duplicate notifications
- [ ] Verify stale data behavior
- [ ] Review logs for anomalies

---

## KPI Tracking

### How to Measure

**Alert Creation Completion Rate**:
```sql
SELECT 
    COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*) as completion_rate
FROM alert_creation_sessions
WHERE created_at > NOW() - INTERVAL '7 days'
```

**Duplicate Alert Trigger Rate**:
```sql
SELECT 
    COUNT(*) FILTER (WHERE duplicate_prevented = true) / COUNT(*) as duplicate_rate
FROM alert_triggers
WHERE created_at > NOW() - INTERVAL '7 days'
```

**Stale Data Evaluation Rate**:
```sql
SELECT 
    COUNT(*) FILTER (WHERE freshness = 'stale') / COUNT(*) as stale_rate
FROM alert_evaluations
WHERE created_at > NOW() - INTERVAL '7 days'
```

---

## Risk Mitigation Actions

### R-01: Ambiguity in Contracts
- Schedule 1-hour contract review meeting
- Tech Lead has final decision authority
- Document unresolved items explicitly

### R-04: Duplicate Trigger
- Implement idempotency before any other changes
- Add comprehensive race condition tests
- Monitor duplicate_prevented_count metric

### R-06: Insufficient Observability
- Start with only high-value events
- Review logs weekly for usefulness
- Add metrics only if actionable

---

## Rollout Strategy

### Staging (Day 1)
1. Deploy all changes to staging
2. Execute full walkthrough
3. Verify all KPIs can be measured
4. Fix any critical issues

### Internal Rollout (Day 2-3)
1. Enable for internal team only
2. Create test alerts
3. Monitor for 24 hours
4. Check logs and metrics

### Controlled User Rollout (Day 4-7)
1. Enable for 10% of users
2. Monitor KPIs closely
3. Pause if any stop criteria met
4. Gradually increase to 50%, then 100%

### Stop Criteria
- Any duplicate notification observed
- Critical invalid transition in logs
- Stale policy causing unexpected behavior
- Send failure rate > 5%
- Worker backlog > 1000

---

## Success Criteria

The hardening is successful when:
- ✅ Alert creation flow has no ambiguity points
- ✅ Asset and price are explicit at all sensitive points
- ✅ Duplicate trigger/send rate is near zero
- ✅ Stale data has defined and defensible behavior
- ✅ Main incidents are detectable and traceable
- ✅ Documentation matches runtime behavior
- ✅ Team has confidence in the core system

---

## Next Steps After Hardening

Once hardening is complete and stable:
1. Review product expansion candidates
2. Prioritize based on user feedback
3. Ensure new features follow established contracts
4. Continue monitoring KPIs
5. Iterate on policies based on real usage data
