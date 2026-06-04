# Product Scope

## Problem Statement

Users want to receive simple, reliable price alerts for selected assets through Bale without relying on heavyweight platforms, foreign SaaS dependencies, or complex infrastructure.

## Target Users

Primary target users:

- Persian-speaking users who use Bale regularly
- users who want threshold-based market alerts
- users who prefer messaging-based interaction over dashboards
- teams that want a self-hosted backend for alerting workflows

## User Segments

### 1. Casual tracker
Needs a few simple alerts for currency/crypto/gold prices.

### 2. Frequent checker
Needs multiple alerts and wants quick access to latest prices via bot.

### 3. Operator/admin
Needs a deployable backend that runs reliably on a VPS with low operational complexity.

## MVP Value Proposition

A user can:

- start the Bale bot
- check latest prices
- define simple above/below threshold alerts
- receive a notification when price conditions are met

And the operator can:

- self-host the service
- run it with PostgreSQL + Redis on one VPS
- operate it without external SaaS lock-in

## What the Product Is

- a backend for Bale-based price alerting
- a self-hostable modular monolith
- an MVP-first system with clear internal boundaries
- an extensible foundation for future provider expansion

## What the Product Is Not

- a full trading platform
- a portfolio tracker
- a social trading app
- a real-time exchange engine
- a complex workflow automation suite
- a multi-channel enterprise notification system in MVP

## Assumptions

- Bale webhook integration is available
- operator can host PostgreSQL and Redis
- initial user scale is moderate
- latest-price semantics are sufficient for MVP
- scheduled/periodic background jobs are acceptable

## Constraints

- self-hosted deployment
- small VPS compatibility
- minimal operational complexity
- limited dependency on external services
- MVP delivery speed is important
- product should remain understandable and maintainable

## Risks

- provider reliability/quality
- Bale API behavior and message delivery constraints
- webhook payload variation
- stale prices if providers fail
- noisy alerting if cooldown logic is weak
- mismatch between documented and real reusable foundation in old repo

## Success Metrics

Suggested MVP metrics:

- webhook processing success rate
- successful price fetch frequency
- alert evaluation success rate
- notification delivery success rate
- low operational incident count
- average time to deploy on a new VPS
- user retention measured by recurring alert usage

## MVP Boundaries

Included in MVP:

- Bale webhook
- user registration from bot interaction
- latest prices
- alert CRUD
- basic alert conditions: above/below
- cooldown support
- price fetch worker
- alert evaluation worker
- Bale notification sending
- mock modes for Bale and provider

Not included in MVP:

- advanced alert expressions
- web dashboard
- portfolio management
- price charts
- multi-channel delivery
- user billing/subscription logic
- complex conversational flows

## Post-MVP Opportunities

- richer provider integrations
- price history endpoints
- admin panel
- alert management via richer bot flow
- notification templates
- analytics/reporting
- localization improvements
- user-level preferences