# API

## Overview

All public business endpoints are versioned under:

```text
/api/v1
```

The backend alert API now follows the post-hardening lifecycle contract: alert creation is staged, activation requires explicit confirmation, asset identity is canonicalized through the backend asset catalog, price units are explicit, stale prices do not trigger notifications, and delivered alert events are idempotent.

> Authentication note: the current API uses the Telegram user dependency configured in the app runtime. Examples below focus on request/response shape and omit auth headers.

---

## Health

### `GET /health`

Basic liveness check.

```http
GET /health
```

```json
{
  "status": "ok",
  "db": "connected"
}
```

---

## Readiness

### `GET /ready`

Lightweight process readiness check.

```http
GET /ready
```

```json
{
  "status": "ready"
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
      "display_unit": "IRT",
      "provider": "mock",
      "fetched_at": "2026-05-18T10:00:00Z",
      "is_stale": false
    }
  ]
}
```

---

### `GET /api/v1/prices/history`

Return recent persisted price snapshots for one asset, newest first. This is a
small read-only history surface backed by the existing `price_snapshots` table;
it does not add a new storage path or change alert evaluation behavior.

Query params:

- `asset_code` (required): asset code such as `USD_IRT` or `BTC`.
- `limit` (optional): number of snapshots to return, from `1` to `500`; default `50`.

```http
GET /api/v1/prices/history?asset_code=USD_IRT&limit=10
```

```json
{
  "items": [
    {
      "asset_code": "USD_IRT",
      "asset_name": "US Dollar",
      "price_value": "1710000",
      "currency_code": "IRT",
      "display_unit": "IRT",
      "provider": "tgju_scrape",
      "observed_at": "2026-06-04T10:10:00Z"
    }
  ]
}
```

Rollback: remove this read-only route from the public API if history proves noisy
or not useful; the existing snapshot persistence is still used internally and is
not coupled to this endpoint.

---

## Metrics

### `GET /metrics`

Return the current in-process observability counters. This endpoint is intentionally small and is meant as a first controlled-expansion metric surface for reliability counters, not as a durable time-series store.

Access control:

- Set `METRICS_ACCESS_TOKEN` in deployed environments and send it as `X-Metrics-Token`.
- In `ENVIRONMENT=production`, the endpoint rejects requests if no valid token is configured/provided.
- Local development can call it without a token when `METRICS_ACCESS_TOKEN` is empty.

```http
GET /metrics
X-Metrics-Token: <token>
```

```json
{
  "metrics": {
    "alert_creation_count": 12,
    "alert_flow_completion_count": 10,
    "notification_send_succeeded_count": 9
  }
}
```

### `GET /metrics/summary`

Return a compact operational summary for rollout checks and lightweight dashboards.
It uses the same `X-Metrics-Token` access control as `/metrics`.

```http
GET /metrics/summary
X-Metrics-Token: <token>
```

```json
{
  "metrics": {
    "notification_send_failed_count": 2
  },
  "alerts_by_state": {
    "active": 14,
    "pending_confirmation": 1
  },
  "events_by_status": {
    "failed": 1,
    "sent": 20
  },
  "latest_prices": {
    "total": 5,
    "fresh": 4,
    "stale": 1,
    "oldest_observed_at": "2026-06-04T10:00:00Z",
    "newest_observed_at": "2026-06-04T10:10:00Z"
  }
}
```

---

## Users

### `GET /api/v1/users/{telegram_user_id}`

Fetch a user by Telegram user id for debug/admin MVP usage.

```http
GET /api/v1/users/123456789
```

```json
{
  "id": "12",
  "telegram_user_id": "123456789",
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
| `user_id` | Owner user id from the authenticated Telegram user context. |
| `asset_id` | Canonical backend asset id resolved from the submitted `asset_code`. |
| `asset_code` | Optional user-facing asset code included when the response was loaded with asset context. |
| `asset_name` | Optional user-facing asset name included when the response was loaded with asset context. |
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
  "asset_code": "USDT",
  "asset_name": "Tether",
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

> Warning: new clients should not rely on `confirm=true` for normal UX. The Telegram Web App uses a two-step client flow: user review, `POST /alerts` to stage the rule, then `POST /confirm` to activate it so the user explicitly sees the asset, condition, normalized target, and unit before activation.

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
  "asset_code": "USDT",
  "asset_name": "Tether",
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
      "asset_code": "USDT",
      "asset_name": "Tether",
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
  "asset_code": "USDT",
  "asset_name": "Tether",
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
