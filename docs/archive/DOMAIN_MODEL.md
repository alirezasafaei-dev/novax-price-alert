# Domain Model

## Overview

The domain is centered on:

- users
- assets
- providers
- prices
- alert rules
- alert events
- notification deliveries

The model is intentionally simple for MVP and optimized for clarity and reliable background processing.

---

## User

### Purpose
Represents a Bale user known to the system.

### Main Fields
- `id`
- `bale_user_id`
- `username`
- `first_name`
- `last_name`
- `is_active`
- `created_at`
- `updated_at`

### Relationships
- one user can own many alert rules
- one user can have many notification deliveries

### Lifecycle Notes
- created when first seen via Bale webhook or other controlled flow
- remains active unless explicitly disabled

### Invariants / Constraints
- `bale_user_id` must be unique
- inactive users should not receive new notifications unless explicitly allowed

---

## Asset

### Purpose
Represents a trackable instrument or market symbol.

### Main Fields
- `id`
- `code`
- `name`
- `category`
- `unit`
- `is_active`
- `created_at`
- `updated_at`

### Relationships
- one asset has many price snapshots
- one asset has one latest price record
- one asset can be referenced by many alert rules

### Lifecycle Notes
- seeded at bootstrap
- future assets may be added manually or operationally

### Invariants / Constraints
- `code` must be unique
- inactive assets should generally not accept new alerts

---

## Provider

### Purpose
Represents a price source.

### Main Fields
- `id`
- `name`
- `slug`
- `is_active`
- `priority`
- `created_at`
- `updated_at`

### Relationships
- one provider can produce many price snapshots
- one provider may be the source of many latest prices

### Lifecycle Notes
- initial provider may be mock-only
- future real providers may be enabled operationally

### Invariants / Constraints
- `slug` must be unique
- provider priority may be used for fallback or preferred source selection

---

## PriceSnapshot

### Purpose
Stores a historical observed price from a provider at fetch time.

### Main Fields
- `id`
- `asset_id`
- `provider_id`
- `price_value`
- `currency_code`
- `fetched_at`
- `raw_payload`

### Relationships
- belongs to one asset
- belongs to one provider

### Lifecycle Notes
- created on each successful fetch cycle
- may be retained with policy-based cleanup later

### Invariants / Constraints
- represents historical observation, not mutable current state
- raw payload is optional but valuable for debugging/provider audits

---

## LatestPrice

### Purpose
Stores the current latest known price per asset.

### Main Fields
- `id`
- `asset_id`
- `provider_id`
- `price_value`
- `currency_code`
- `fetched_at`
- `updated_at`

### Relationships
- belongs to one asset
- belongs to one provider

### Lifecycle Notes
- upserted on successful fetch
- always intended to represent the most recent accepted price for an asset

### Invariants / Constraints
- one row per asset
- `asset_id` unique
- must reflect latest accepted value, not arbitrary historical data

---

## AlertRule

### Purpose
Represents a user-defined alert condition.

### Main Fields
- `id`
- `user_id`
- `asset_id`
- `condition_type`
- `target_price`
- `is_active`
- `cooldown_minutes`
- `last_triggered_at`
- `created_at`
- `updated_at`

### Relationships
- belongs to one user
- belongs to one asset
- can produce many alert events

### Lifecycle Notes
- created by API or future bot-driven flow
- may be updated, deactivated, or deleted

### Invariants / Constraints
- `condition_type` must be one of: `above`, `below`
- `target_price` must be positive
- only active alerts are evaluated
- `(user_id, asset_id, is_active)` should be indexed for common queries

---

## AlertEvent

### Purpose
Represents an actual alert trigger occurrence.

### Main Fields
- `id`
- `alert_rule_id`
- `triggered_price`
- `triggered_at`
- `status`

### Relationships
- belongs to one alert rule
- may lead to one or more notification deliveries depending on future evolution

### Lifecycle Notes
- created when an active rule matches latest price and cooldown permits
- status evolves from pending to sent/failed

### Invariants / Constraints
- status must be one of:
  - `pending`
  - `sent`
  - `failed`

---

## NotificationDelivery

### Purpose
Tracks outbound notification attempts.

### Main Fields
- `id`
- `user_id`
- `alert_event_id`
- `channel`
- `message_text`
- `status`
- `error_message`
- `sent_at`
- `created_at`

### Relationships
- belongs to one user
- belongs to one alert event

### Lifecycle Notes
- created during notification send workflow
- updated with success/failure outcome

### Invariants / Constraints
- channel defaults to `bale`
- status must be one of:
  - `pending`
  - `sent`
  - `failed`

---

## Key Domain Rules

### Rule 1 — Latest price drives alert evaluation
Alerts are evaluated against `LatestPrice`, not against arbitrary historical snapshots.

### Rule 2 — Snapshots are audit/history, not active trigger source
`PriceSnapshot` preserves fetch history; `LatestPrice` is the canonical source for current alert checks.

### Rule 3 — Alerts only fire when active
Inactive alerts are ignored.

### Rule 4 — Cooldown prevents alert spam
If an alert has fired recently, it cannot fire again until its cooldown window expires.

### Rule 5 — Notification outcome is tracked explicitly
A triggered event and a sent notification are not the same thing.  
This separation allows failure visibility.

---

## Alert Triggering Rules

For each active alert:

- load current latest price of target asset
- compare `price_value` to `target_price`
- if `condition_type = above`, trigger when current price is greater than or equal to target semantics chosen by implementation
- if `condition_type = below`, trigger when current price is less than or equal to target semantics chosen by implementation

Recommended MVP rule:
- `above` => current price `>= target_price`
- `below` => current price `<= target_price`

## Cooldown Behavior

If `last_triggered_at` is not null:

- compute next allowed trigger time
- skip event creation if current time is before that threshold

Cooldown is per alert rule, not global per asset.

## Latest Price Semantics

`LatestPrice` means:

- latest successfully normalized and accepted value
- not necessarily real-time
- source-traceable to a provider
- updated when fetch job succeeds

## Notification Semantics

Notification sending is asynchronous.

Flow:

- alert condition matched
- `AlertEvent` created
- notification job enqueued
- Bale message sent or mocked
- `NotificationDelivery` saved
- statuses updated