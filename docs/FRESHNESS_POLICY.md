# Freshness Policy (T-005)

Status: **Frozen** (Phase 0 — Contract Freeze).
Defines when price data is `fresh`, `stale`, or `unavailable`, and the resulting behavior.

This reflects the **implemented** policy in
`src/novax_price_alert/services/freshness.py` (`FreshnessPolicy`, `classify_latest_price`)
and `src/novax_price_alert/domain/enums.py` (`PriceFreshness`). The example thresholds in
`HARDENING_IMPLEMENTATION_GUIDE.md` (seconds-scale, with a `delayed` tier) were placeholders;
this contract freezes the **minute/hour-scale** thresholds that match a 10-minute evaluation
cron and the realities of the TGJU/Binance providers.

## Classifications (source of truth)

`PriceFreshness` has **three** values (no `delayed` tier):

| Classification | Meaning                                  |
|----------------|------------------------------------------|
| `fresh`        | Recent enough to evaluate and trigger    |
| `stale`        | Too old to trust for triggering          |
| `unavailable`  | Missing data / no usable timestamp       |

## Thresholds (frozen, `DEFAULT_FRESHNESS_POLICY`)

| Parameter                 | Value        |
|---------------------------|--------------|
| Expected update cadence   | 5 minutes    |
| Fresh threshold           | 10 minutes   |
| Stale threshold           | 30 minutes   |
| Unavailable threshold     | 2 hours      |

Thresholds are configurable via the `FreshnessPolicy` dataclass (override per call); the
defaults above are the frozen production values.

## Classification logic

From `classify_latest_price(latest, now, policy)`:

1. `latest is None` → `unavailable` (`missing_latest_price`).
2. `latest.is_stale` (provider-marked) → `stale` (`provider_marked_stale`).
3. `observed_at is None` → `unavailable` (`missing_observed_at`).
4. `stale_after` set and `now >= stale_after` → `stale` (`stale_after_elapsed`).
5. `age >= unavailable_threshold` (2h) → `unavailable`
   (`observed_at_unavailable_threshold_elapsed`).
6. `age >= stale_threshold` (30m) → `stale` (`observed_at_stale_threshold_elapsed`).
7. Otherwise → `fresh` (`within_freshness_threshold`).

Every result carries a machine-readable `reason` (the strings above) for observability.

## Behavior

- **Display**: sensitive price displays should surface freshness context (e.g. last-update
  time) when not `fresh`.
- **Trigger**: evaluation is **allowed only when `fresh`**
  (`FreshnessResult.evaluation_allowed == (classification == FRESH)`).
- `stale` or `unavailable` data **blocks triggering** and emits a `stale_data_detected`
  structured log with the classification and reason (see `ALERT_HARDENING_CONTRACTS.md`).

> Note: there is currently no separate `delayed` tier. Data between the fresh threshold
> (10m) and stale threshold (30m) is still classified `fresh` for evaluation purposes; a
> finer-grained `delayed` tier is explicitly out of scope for Phase 0.

## Acceptance criteria (T-005)

- [x] Freshness states are specified (`fresh`/`stale`/`unavailable`).
- [x] Thresholds are documented and configurable (`FreshnessPolicy`).
- [x] Per-state behavior (display + trigger) is defined.
- [x] `stale`/`unavailable` blocks triggering and is observable (`stale_data_detected`).
- [x] Divergence from the guide's placeholder thresholds is called out and reconciled.
