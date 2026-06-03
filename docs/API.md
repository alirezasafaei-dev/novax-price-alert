# API

## Overview

All public business endpoints are versioned under:

```text
/api/v1
```

The backend alert API now follows the post-hardening lifecycle contract: alert creation is staged, activation requires explicit confirmation, asset identity is canonicalized through the backend asset catalog, price units are explicit, stale prices do not trigger notifications, and delivered alert events are idempotent.

> Authentication note: the current API uses the Telegram/Bale user dependency configured in the app runtime. Examples below focus on request/response shape and omit auth headers.

---

## Health

### `GET /health`

Basic liveness check.

```http
GET /health
```

```json
{
  "status": "ok"
}
```

---

## Readiness

### `GET /ready`

Dependency readiness check.

```http
GET /ready
```

```json
{
  "status": "ready",
  "database": "ok",
  "redis": "ok"
}
```

Failure example:

```json
{
  "status": "not_ready",
  "database": "ok",
  "redis": "error"
}
```

---

## Prices

### `GET /api/v1/prices/latest`

Return latest known prices. These are not guaranteed to be real-time market prices.

Query params:

- `asset_code` (optional): filter to one asset code when available.

```http
GET /api/v1/prices/latest?asset_code=USDT
```

```json
{
  "items": [
    {
      "asset_code": "USDT",
      "asset_name": "Tether",
      "price_value": "652000",
      "currency_code": "IRT",
      "provider": "mock",
      "fetched_at": "2026-05-18T10:00:00Z",
      "is_stale": false
    }
  ]
}
```

---

## Users

### `GET /api/v1/users/{bale_user_id}`

Fetch a user by Bale user id for debug/admin MVP usage.

```http
GET /api/v1/users/123456789
```

```json
{
  "id": "12",
  "bale_user_id": "123456789",
  "username": "ali_dev",
  "first_name": "Ali",
  "last_name": "Safaei",
  "is_active": true,
  "created_at": "2026-05-18T10:00:00Z",
  "updated_at": "2026-05-18T10:00:00Z"
}
```

Error cases:

- `404` if user not found.

---

## Alerts

### Lifecycle summary

Alert lifecycle states exposed by the API include:

- `pending_confirmation`: created/staged, not active, not evaluated.
- `active`: explicitly confirmed and eligible for evaluation.
- `paused`: intentionally not evaluated.
- `triggered` / `delivery_in_progress` / `delivered`: one-shot delivery path states.
- `cancelled`: deleted/cancelled by user and not evaluated.
- `failed`: delivery failed and requires operator review or a future retry policy.

Runtime invariants:

- `POST /alerts` creates `pending_confirmation` by default with `is_active=false`.
- `POST /alerts/{alert_id}/confirm` is the preferred activation path.
- Asset input is resolved to the canonical backend asset id; responses expose `asset_id` and preserve `display_asset_name_at_creation`.
- `target_price` is normalized and `target_price_display_unit` is snapshotted at creation.
- Freshness-aware evaluation skips stale/missing provider data.
- Delivered one-shot alerts/events are finalized and must not be re-sent by later evaluation/dispatch cycles.

### Alert response fields

All alert response objects use this shape:

| Field | Meaning |
|---|---|
| `id` | Alert id. |
| `user_id` | Owner user id from the authenticated Telegram/Bale user context. |
| `asset_id` | Canonical backend asset id resolved from the submitted `asset_code`. |
| `display_asset_name_at_creation` | User-facing asset label snapshotted when the alert was created. |
| `condition_type` | `above` or `below`. |
| `target_price` | Normalized positive threshold value. |
| `target_price_display_unit` | Explicit display/comparison unit snapshotted from the asset, for example `IRT`, `Toman`, or `USDT` depending on runtime catalog. |
| `lifecycle_state` | Current lifecycle state. |
| `is_active` | Compatibility flag; authoritative activation is still `lifecycle_state=active`. |
| `cooldown_minutes` | Cooldown setting retained for compatibility/future recurring policies. |
| `last_triggered_at` | Legacy/compatibility trigger timestamp. |
| `confirmed_at` | Set when the alert is explicitly activated. |
| `triggered_at` | Set when evaluation claims/triggers the alert. |
| `delivered_at` | Set when notification delivery succeeds. |
| `cancelled_at` | Set when the alert is cancelled/deleted. |
| `created_at` / `updated_at` | Persistence timestamps. |

### `POST /api/v1/alerts`

Create a new staged alert rule. By default the alert is **not active** until confirmed.

Request body:

```json
{
  "asset_code": "USDT",
  "condition_type": "above",
  "target_price": "700000",
  "cooldown_minutes": 60
}
```

Response example (`201 Created`):

```json
{
  "id": "21",
  "user_id": "12",
  "asset_id": "asset-usdt",
  "display_asset_name_at_creation": "Tether",
  "condition_type": "above",
  "target_price": "700000",
  "target_price_display_unit": "IRT",
  "lifecycle_state": "pending_confirmation",
  "is_active": false,
  "cooldown_minutes": 60,
  "last_triggered_at": null,
  "confirmed_at": null,
  "triggered_at": null,
  "delivered_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-18T10:00:00Z",
  "updated_at": "2026-05-18T10:00:00Z"
}
```

#### Backward compatibility: `confirm=true`

`confirm` is accepted in the create payload for legacy callers:

```json
{
  "asset_code": "USDT",
  "condition_type": "above",
  "target_price": "700000",
  "cooldown_minutes": 60,
  "confirm": true
}
```

When `confirm=true`, the backend creates the alert and immediately runs the confirmation transition, returning `lifecycle_state="active"`, `is_active=true`, and `confirmed_at` set.

> Warning: new clients should not rely on `confirm=true` for normal UX. Use a two-step create → review → `POST /confirm` flow so the user explicitly sees the asset, condition, normalized target, and unit before activation.

Error cases:

- `400` invalid lifecycle transition or request.
- `404` unknown asset.
- `422` schema validation failure, for example non-positive target price.

### `POST /api/v1/alerts/{alert_id}/confirm`

Confirm and activate a staged alert owned by the current user.

```http
POST /api/v1/alerts/21/confirm
```

Response example:

```json
{
  "id": "21",
  "user_id": "12",
  "asset_id": "asset-usdt",
  "display_asset_name_at_creation": "Tether",
  "condition_type": "above",
  "target_price": "700000",
  "target_price_display_unit": "IRT",
  "lifecycle_state": "active",
  "is_active": true,
  "cooldown_minutes": 60,
  "last_triggered_at": null,
  "confirmed_at": "2026-05-18T10:02:00Z",
  "triggered_at": null,
  "delivered_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-18T10:00:00Z",
  "updated_at": "2026-05-18T10:02:00Z"
}
```

Error cases:

- `404` alert not found for the current user.
- `409` invalid transition, for example confirming an already delivered/cancelled alert.

### `GET /api/v1/alerts`

List alerts owned by the current user.

```http
GET /api/v1/alerts
```

```json
{
  "items": [
    {
      "id": "21",
      "user_id": "12",
      "asset_id": "asset-usdt",
      "display_asset_name_at_creation": "Tether",
      "condition_type": "above",
      "target_price": "700000",
      "target_price_display_unit": "IRT",
      "lifecycle_state": "active",
      "is_active": true,
      "cooldown_minutes": 60,
      "last_triggered_at": null,
      "confirmed_at": "2026-05-18T10:02:00Z",
      "triggered_at": null,
      "delivered_at": null,
      "cancelled_at": null,
      "created_at": "2026-05-18T10:00:00Z",
      "updated_at": "2026-05-18T10:02:00Z"
    }
  ]
}
```

### `PATCH /api/v1/alerts/{alert_id}`

Update an alert rule. Target price updates are normalized. Updating the target of an active alert pauses it so it cannot silently continue with a changed threshold without operator/client awareness.

Request body:

```json
{
  "target_price": "710000",
  "cooldown_minutes": 120,
  "is_active": false
}
```

Response example:

```json
{
  "id": "21",
  "user_id": "12",
  "asset_id": "asset-usdt",
  "display_asset_name_at_creation": "Tether",
  "condition_type": "above",
  "target_price": "710000",
  "target_price_display_unit": "IRT",
  "lifecycle_state": "paused",
  "is_active": false,
  "cooldown_minutes": 120,
  "last_triggered_at": null,
  "confirmed_at": "2026-05-18T10:02:00Z",
  "triggered_at": null,
  "delivered_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-18T10:00:00Z",
  "updated_at": "2026-05-18T10:30:00Z"
}
```

Compatibility note: `is_active=true` is still accepted by the runtime and maps to an activation transition. Prefer `POST /confirm` for user-facing activation flows.

Error cases:

- `404` alert not found for the current user.
- `409` or `400` if the requested lifecycle transition is invalid.
- `422` schema validation failure.

### `DELETE /api/v1/alerts/{alert_id}`

Cancel/delete an alert for the current user. The backend marks the alert lifecycle as `cancelled`, sets `cancelled_at`, and excludes it from future evaluation.

```http
DELETE /api/v1/alerts/21
```

```json
{
  "success": true
}
```

Error cases:

- `404` alert not found for the current user.
