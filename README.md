# bale-price-alert

Self-hostable backend for a Bale price alert bot, designed for fast MVP delivery on a single VPS with production-aware defaults.

## Overview

`bale-price-alert` is a backend service for:

- registering and tracking Bale users
- fetching asset prices from configured providers
- storing latest market prices and historical snapshots
- creating user-defined alert rules
- evaluating alert conditions in background jobs
- sending Bale notifications when alert conditions are met

This project is intentionally designed as a **modular monolith** for the MVP stage.  
The goal is to move quickly, keep deployment simple, and reuse proven backend infrastructure patterns from the existing `rubika-bot-saas` foundation where they are product-agnostic.

## Why This Project Exists

In a local/self-hosted environment, teams often need a lightweight alerting product that:

- does not depend on foreign managed platforms
- can run on a small VPS
- supports messaging-based user interaction
- keeps infrastructure simple
- is easy to operate and extend

This project solves that problem by combining:

- FastAPI for HTTP APIs and webhook handling
- PostgreSQL for durable storage
- Redis + RQ for background processing
- Bale as the end-user notification channel

## MVP Features

- Bale webhook endpoint
- Bale user registration on `/start`
- latest price retrieval
- basic asset seed data
- create/list/update/delete alert rules
- periodic price fetching
- periodic alert evaluation
- Bale notification sending
- mock provider mode
- mock Bale mode
- health and readiness endpoints

## Stack

- Python 3.12
- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis
- RQ
- Pydantic v2
- pydantic-settings
- httpx
- pytest
- Ruff
- MyPy
- Docker / Docker Compose

## Architecture Summary

The system is a modular monolith with clear internal boundaries:

- `api`: HTTP endpoints and webhook entrypoints
- `services`: business logic
- `repositories`: database access
- `models`: persistence models
- `integrations`: Bale + price providers
- `workers`: background jobs for prices, alert evaluation, notifications
- `db/core`: shared infrastructure

The project intentionally reuses the architectural direction already established in `rubika-bot-saas`:

- versioned API
- environment-based config
- PostgreSQL + SQLAlchemy + Alembic
- Redis + RQ
- centralized operational concerns
- production-aware MVP defaults

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/REUSE_PLAN.md](docs/REUSE_PLAN.md).

## Repository Structure

```text
bale-price-alert/
├── app/
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── integrations/
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   ├── workers/
│   ├── seed/
│   └── main.py
├── alembic/
├── docs/
├── scripts/
├── tests/
├── .env.example
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── openapi.yaml
├── pyproject.toml
└── README.md

```
## Quick Start

### 1. Configure environment

bash
cp .env.example .env

Update values in `.env` as needed.

### 2. Start infrastructure

bash
docker compose up -d postgres redis

### 3. Run migrations

bash
make migrate

### 4. Seed initial assets

bash
make seed-assets

### 5. Start the API

bash
make dev

### 6. Start the worker

bash
make worker

## Environment Overview

Expected environment categories:

- app/runtime config
- PostgreSQL connection
- Redis connection
- Bale integration settings
- provider settings
- secrets/security settings

See:
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)

## Docker Usage

Typical local startup:

bash
docker compose up --build

Expected services:

- `api`
- `worker`
- `postgres`
- `redis`

Optional:
- `scheduler`

## Migrations

Alembic is used from the beginning.

Typical commands:

bash
make makemigrations
make migrate

## Seed Flow

The project includes an asset seed process for initial supported assets:

- USDT
- USD
- EUR
- BTC
- ETH
- GOLD18
- EMAMI_COIN

bash
make seed-assets

## Worker Flow

Background jobs cover:

- price fetching
- alert evaluation
- notification sending

See [docs/JOBS_AND_WORKERS.md](docs/JOBS_AND_WORKERS.md).

## Tests

Typical test run:

bash
make test

Minimum MVP test coverage should include:

- health/readiness
- latest prices endpoint
- alert creation
- webhook `/start` flow

## Documentation

- [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md)
- [docs/API.md](docs/API.md)
- [docs/BOT_BEHAVIOR.md](docs/BOT_BEHAVIOR.md)
- [docs/JOBS_AND_WORKERS.md](docs/JOBS_AND_WORKERS.md)
- [docs/PROVIDERS.md](docs/PROVIDERS.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/REUSE_PLAN.md](docs/REUSE_PLAN.md)
