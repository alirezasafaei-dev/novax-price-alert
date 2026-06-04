# Alert Flow Contract (T-003)

Status: **Frozen** (Phase 0 — Contract Freeze).
Reference, step-based contract for alert creation across the Telegram Worker and backend.

This reflects the **implemented** flow. The frozen flow uses one main decision per step and
requires an explicit final confirmation before activation.

## Worker flow states

Source of truth: `FLOW_STATES` in `deploy/cloudflare-worker/src/alert-flow.js`.

| State                  | Meaning                                    |
|------------------------|--------------------------------------------|
| `choosing_market`      | User picks market (crypto / fiat / gold)   |
| `choosing_asset`       | User picks an asset within the market      |
| `choosing_condition`   | User picks `above` (بالاتر) / `below` (پایین‌تر) |
| `entering_price`       | User types the target price                |
| `awaiting_confirmation`| Summary shown; awaiting explicit confirm   |
| `completed`            | Alert confirmed and activated              |
| `abandoned`            | User cancelled / backed out                |
| `errored`              | Flow ended in an error                     |

Step state is stored in the KV session so each step validates the prior one.

## Reference flow (happy path)

1. **Choose market** → `choosing_market`
2. **Choose asset** → `choosing_asset`
   - Selected asset is echoed as `{Display Name} ({SYMBOL})` (see Asset Identity Policy).
3. **Choose condition** → `choosing_condition`
   - `operatorLabel(above) = "بالاتر از"`, `operatorLabel(below) = "پایین‌تر از"`.
4. **Enter target price** → `entering_price`
   - Parsed via `normalizeTargetPrice` (Persian/Arabic digits, separators, `> 0`).
   - Unit shown explicitly per market (USDT for crypto, تومان for fiat/gold).
5. **Review summary** → `awaiting_confirmation`
   - `buildAlertSummary` renders asset, condition + target (with unit), and current price:
     ```
     لطفاً هشدار را بررسی و تایید کن:

     دارایی: {display_asset_name_at_creation}
     شرط: {operatorLabel} {formatted target} {unit}
     قیمت فعلی: {current price text}

     بعد از تایید، هشدار فعال می‌شود.
     ```
6. **Confirm** → `completed`
   - Only an explicit confirmation activates the alert.

## Error & cancellation paths

- **Invalid price** (`normalizeTargetPrice` → `null`): stay in `entering_price`, show an
  actionable error ("قیمت واردشده قابل تشخیص نیست…"), re-prompt.
- **Cancel / back out**: transition to `abandoned`; no alert is activated.
- **Unexpected/runtime error**: transition to `errored`; surface a safe message.

## Backend contract (staged activation)

Source of truth: `docs/ALERT_HARDENING_CONTRACTS.md` ("Alert creation flow").

- The API creates alerts in **`pending_confirmation`** by default.
- Activation requires `POST /alerts/{alert_id}/confirm` (or a deliberate `confirm=true`
  for backward-compatible one-call clients).
- `display_asset_name_at_creation` and `target_price_display_unit` are snapshotted at
  creation.

## Acceptance criteria (T-003)

- [x] Flow is step-based with one main decision per step.
- [x] Selected asset and unit are visible at sensitive points (price entry, summary).
- [x] No activation without an explicit confirmation step.
- [x] Error and cancellation paths are defined (`entering_price` re-prompt, `abandoned`,
      `errored`).
- [x] Worker flow and backend `pending_confirmation` → `active` staging are aligned.
