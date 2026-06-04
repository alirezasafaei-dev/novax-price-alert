# Architecture

## Overview

`novax-price-alert` is designed as a **modular monolith**.  
This architecture is chosen for the MVP because it provides:

- fast delivery
- simple deployment
- low operational overhead
- clean internal structure
- future extensibility without early microservice complexity

The system runs as a single backend application with background workers.

Core runtime pieces:

- FastAPI application
- PostgreSQL database
- Redis queue
- RQ workers
- Telegram integration adapter
- price provider adapter(s)

## Architectural Intent

This project is a product-first, Telegram-centric modular monolith. The architecture should reflect the current codebase and the hardening work distilled into the live docs.

The live architecture aligns with these principles:

- FastAPI-based modular backend
- `/api/v1` versioned routing
- environment-based configuration
- PostgreSQL + SQLAlchemy + Alembic
- background workers for price fetch, alert evaluation, and notification dispatch
- canonical asset identity for alert evaluation
- explicit price units and snapshots in alert data
- freshness-aware triggering
- idempotent notification delivery
- structured logging and rollout-friendly observability
- self-hostable deployment with a Cloudflare relay for Telegram sends

## Source of Truth

The live source of truth is the repository code and the short living docs:

- `src/novax_price_alert/`
- `deploy/cloudflare-worker/`
- `docs/PROGRESS.md`
- `docs/API.md`
- `docs/OBSERVABILITY.md`
- `docs/OPERATIONS.md`

The live docs encode the current hardening decisions and runtime design. Retired reports are historical context only and are not required for day-to-day engineering or operations.

## High-Level Component Model

```text
Telegram User
   |
   v
Telegram Bot / Webhook
   |
   v
FastAPI API Layer
   |
   v
Application Services
   |
   +--> Repositories --> PostgreSQL
   |
   +--> Provider Integrations --> External / Mock Providers
   |
   +--> Redis Queue --> RQ Workers --> Telegram Notifications

```

## Core Modules

### 1. API Layer

Responsibilities:

- expose HTTP endpoints
- validate requests
- map transport data to service calls
- return stable response schemas
- keep handlers thin

Modules:

- health
- readiness
- prices
- alerts
- users
- bot webhook

### 2. Services Layer

Responsibilities:

- enforce business rules
- coordinate repositories
- coordinate integrations
- evaluate alert logic
- orchestrate background workflows

Expected service modules:

- `user_service`
- `asset_service`
- `price_fetch_service`
- `price_normalization_service`
- `alert_service`
- `alert_evaluator_service`
- `notification_service`

### 3. Repositories Layer

Responsibilities:

- isolate database access logic
- provide query/update methods for domain entities
- keep persistence details out of API handlers

### 4. Integrations Layer

Responsibilities:

- Telegram API adapter
- Telegram payload parsing
- Telegram message formatting
- provider abstraction and normalization

### 5. Worker Layer

Responsibilities:

- process asynchronous jobs
- keep slow or retry-prone work out of request path
- handle price fetch / evaluation / notification send

## Module Boundaries

### User Module

Owns:

- Telegram user identity
- user lifecycle for bot interaction

### Asset/Price Module

Owns:

- supported assets
- provider-fed prices
- latest price state
- historical price snapshots

### Alert Module

Owns:

- alert rules
- condition matching
- cooldown enforcement
- alert event creation

### Notification Module

Owns:

- outgoing Telegram notifications
- delivery status tracking

### Bot Integration Module

Owns:

- webhook parsing
- command handling
- Telegram-specific formatting and transport

## Request Flow

Typical synchronous request flow:

text
HTTP Request
-> FastAPI route
-> request schema validation
-> service call
-> repository/integration access
-> response schema
-> HTTP response

## Webhook Flow

text
Telegram webhook
-> /api/v1/bot/webhook
-> defensive payload parser
-> user extraction
-> command detection
-> command handler/service
-> optional DB update
-> optional Telegram response send
-> safe HTTP response

Principles:

- never trust webhook payload shape
- fail safely
- avoid retry storms
- log malformed payloads with care
- do not leak internal errors

## Provider Fetch Flow

text
Scheduled trigger / manual trigger
-> fetch_prices job
-> provider registry
-> selected provider(s)
-> normalize output
-> persist PriceSnapshot
-> upsert LatestPrice

## Alert Evaluation Flow

text
evaluate_alerts job
-> load active alerts
-> load latest prices
-> compare condition_type with target_price
-> enforce cooldown
-> create AlertEvent
-> enqueue send_notifications
-> update last_triggered_at

## Notification Flow

text
send_notifications job
-> load AlertEvent + User
-> format Telegram message
-> Telegram client send
-> create NotificationDelivery record
-> update event/delivery status

## Persistence Model Overview

Main persistent entities:

- `User`
- `Asset`
- `Provider`
- `PriceSnapshot`
- `LatestPrice`
- `AlertRule`
- `AlertEvent`
- `NotificationDelivery`

Design goals:

- durable alert history
- clear current/latest price state
- traceable notification outcomes
- future multi-provider support

## Queue / Worker Model

RQ is chosen for MVP because:

- it matches the old project direction
- it is simple to operate
- it is enough for scheduled/background tasks
- it keeps the system deployable on a small VPS

Queue responsibilities:

- background price fetches
- alert evaluations
- outbound notification sending

## Design Principles

- self-hostable first
- operational simplicity over sophistication
- reuse proven backend patterns
- transport/business/integration separation
- thin API routes
- explicit persistence
- safe webhook behavior
- mockable external integrations
- production-aware defaults

## Non-Goals for MVP

- microservices
- multi-tenant enterprise control plane
- advanced portfolio analytics
- strategy engines
- high-frequency market ingestion
- highly dynamic workflow builders
- complex end-user conversational flows
- multi-channel notification routing beyond Telegram
