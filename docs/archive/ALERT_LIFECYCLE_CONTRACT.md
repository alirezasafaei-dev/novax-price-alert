# Alert Lifecycle Contract (T-004)

Status: **Frozen** (Phase 0 — Contract Freeze).
Formal definition of alert states, the allowed transitions, and event timestamps.

This reflects the **implemented** state machine in
`src/novax_price_alert/domain/alert_rule.py` (`AlertRule.VALID_TRANSITIONS`) and
`src/novax_price_alert/domain/enums.py` (`AlertLifecycleState`). Where the
`HARDENING_IMPLEMENTATION_GUIDE.md` proposed different names (`notifying`, `notified`,
`completed`), this contract wins; a name mapping is provided below.

## States (source of truth)

| State                   | Meaning                                                  |
|-------------------------|----------------------------------------------------------|
| `draft`                 | Creation started, nothing chosen yet                     |
| `awaiting_condition`    | Asset chosen, awaiting above/below                       |
| `awaiting_target_price` | Condition chosen, awaiting target price                  |
| `pending_confirmation`  | Summary shown, awaiting explicit confirmation            |
| `active`                | Confirmed and watching for the trigger condition         |
| `triggered`             | Condition met; ready to dispatch                         |
| `delivery_in_progress`  | Notification claimed by a worker and being sent          |
| `delivered`             | Notification sent successfully (terminal)                |
| `paused`                | Temporarily disabled by the user                         |
| `cancelled`             | Cancelled (terminal)                                     |
| `failed`                | Error during evaluation/delivery (recoverable)           |

### Mapping from the guide's proposed names

| Guide name  | Frozen state(s)                          |
|-------------|------------------------------------------|
| `notifying` | `delivery_in_progress`                   |
| `notified`  | `delivered`                              |
| `completed` | `delivered` (one-shot alerts are terminal at `delivered`) |

## Valid transitions (source of truth)

From `AlertRule.VALID_TRANSITIONS`:

| From                    | Allowed to                                                        |
|-------------------------|-------------------------------------------------------------------|
| `draft`                 | `awaiting_condition`, `cancelled`                                 |
| `awaiting_condition`    | `awaiting_target_price`, `cancelled`                             |
| `awaiting_target_price` | `pending_confirmation`, `awaiting_condition`, `cancelled`        |
| `pending_confirmation`  | `active`, `awaiting_target_price`, `cancelled`                   |
| `active`                | `triggered`, `paused`, `cancelled`, `failed`                     |
| `triggered`             | `delivery_in_progress`, `failed`                                |
| `delivery_in_progress`  | `delivered`, `failed`                                            |
| `delivered`             | — (terminal)                                                     |
| `paused`                | `active`, `cancelled`                                            |
| `cancelled`             | — (terminal)                                                     |
| `failed`                | `active`, `cancelled` (retry/recover)                           |

State diagram (happy path + branches):

```
draft → awaiting_condition → awaiting_target_price → pending_confirmation → active
                                                                              │
                       active → triggered → delivery_in_progress → delivered (terminal)
                       active → paused → active | cancelled
                       active/triggered/delivery → failed → active | cancelled
                       (any creation step) → cancelled (terminal)
```

## Invalid transitions

- `AlertRule.transition_to(next_state)` raises `InvalidAlertTransitionError` when
  `next_state` is not in `VALID_TRANSITIONS[current_state]`.
- Services that catch it emit an `invalid_transition_detected` structured log and increment
  `invalid_transition_count` (see Observability in `ALERT_HARDENING_CONTRACTS.md`).

## Event timestamps & related status

- Delivery attempts are tracked on `alert_events` with `AlertEventStatus`
  (`pending`, `delivery_in_progress`, `sent`, `failed`) — see `domain/enums.py`.
- Idempotency, atomic claim, and retry semantics for delivery are defined in
  `ALERT_HARDENING_CONTRACTS.md` ("Trigger idempotency and concurrency", "Retry policy").

## Worker subset

The Cloudflare Worker tracks a simplified lifecycle (`ALERT_LIFECYCLE` in
`alert-flow.js`): `pending_confirmation`, `active`, `delivery_in_progress`, `delivered`,
`cancelled`, `failed`. The backend enum is the authoritative superset; the Worker subset
must never introduce a state outside the backend enum.

## Acceptance criteria (T-004)

- [x] Alert lifecycle is formally defined as an enum (`AlertLifecycleState`).
- [x] Valid transitions are explicit and enforced (`VALID_TRANSITIONS` + `transition_to`).
- [x] Invalid transitions are rejected, logged, and counted.
- [x] Terminal states (`delivered`, `cancelled`) are identified.
- [x] Guide-name → frozen-state mapping is documented to remove ambiguity.
