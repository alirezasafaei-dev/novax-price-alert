<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/alirezasafaei-dev/novax-price-alert/main/docs/assets/logo-dark.svg">
    <img alt="Novax Price Alert" src="https://raw.githubusercontent.com/alirezasafaei-dev/novax-price-alert/main/docs/assets/logo-light.svg" width="180">
  </picture>
</p>

<h1 align="center">Novax Price Alert</h1>

<p align="center">
  <b>Iran‑market Telegram price‑alert backend</b><br>
  Cryptocurrency · Fiat (IRR) · Tether (USDT) · Gold
</p>

<p align="center">
  <a href="https://github.com/alirezasafaei-dev/novax-price-alert/actions/workflows/ci.yml">
    <img src="https://github.com/alirezasafaei-dev/novax-price-alert/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://github.com/alirezasafaei-dev/novax-price-alert/actions/workflows/security-scan.yml">
    <img src="https://github.com/alirezasafaei-dev/novax-price-alert/actions/workflows/security-scan.yml/badge.svg" alt="Security">
  </a>
  <a href="https://github.com/alirezasafaei-dev/novax-price-alert/actions/workflows/cron-heartbeat-monitor.yml">
    <img src="https://github.com/alirezasafaei-dev/novax-price-alert/actions/workflows/cron-heartbeat-monitor.yml/badge.svg" alt="Heartbeat">
  </a>
  <img src="https://img.shields.io/badge/python-3.10%2B-blue" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/node-%3E%3D22-green" alt="Node >=22">
  <img src="https://img.shields.io/badge/license-MIT-yellow" alt="License MIT">
</p>

---

## Overview

Novax Price Alert is a production-grade Telegram bot that monitors Iran‑market prices — cryptocurrency pairs from **Binance** and fiat/Tether/gold rates from **TGJU** — and delivers alerts via a menu‑driven Telegram interface.

Users configure alerts through an inline keyboard flow, explicitly confirm each alert before activation, and receive notifications when their target price is hit. A companion **React Mini App** provides a richer mobile experience inside Telegram.

The system is designed for **dual deployment**: a primary serverless path on **Cloudflare Workers + D1** and a fallback on a **VPS with Docker Compose** (FastAPI + PostgreSQL + Redis + Nginx).

---

## Features

- **Multi‑asset price monitoring** — crypto (Binance `USDT`), fiat (IRR), Tether, and gold (TGJU, IRR‑denominated)
- **Menu‑driven Telegram bot** — inline keyboard navigation, no commands to memorise
- **Explicit confirmation** — alerts only activate after the user confirms
- **Scheduled checks** — cron every 1 hour (Cloudflare free‑plan friendly)
- **Dual deployment** — serverless (Cloudflare Worker + D1) primary, Docker Compose VPS fallback
- **Telegram Mini App** — React‑based mobile interface served via Cloudflare KV or FastAPI
- **Heartbeat monitoring** — GitHub Actions checks `/status` every 5 minutes; alerts ops on cooldown
- **Growth / marketing tools** — optional automated daily market channel posts
- **Security scanning** — automated dependency audit, SAST (Bandit), and secret detection via CI

---

## Architecture

```
Telegram user
  │
  ├── Telegram Bot API (webhook)
  │     └── Cloudflare Worker ──┬── D1 (users, alerts, subscriptions, payments)
  │                              ├── KV (assets, sessions, cache)
  │                              └── Telegram Bot API (outbound)
  │
  └── Telegram Mini App
        └── Cloudflare Worker (static assets via ASSETS_KV & API routes)
```

### Fallback VPS path

```
Telegram user
  ├── Telegram Bot API (webhook) ──→ Nginx ──→ FastAPI ──┬── PostgreSQL
  │                                                        └── Redis
  └── Telegram Mini App ──────────────────────────→ FastAPI (static /mini-app/)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full detail.

---

## Tech Stack

| Layer        | Technology                                                                    |
| ------------ | ----------------------------------------------------------------------------- |
| **Primary**  | Cloudflare Workers (JavaScript/ES2022), D1 (SQLite), Workers KV               |
| **Backend**  | Python 3.10+ · FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2                 |
| **Database** | PostgreSQL 15 (asyncpg) · D1 (production) · aiosqlite (dev)                   |
| **Cache**    | Redis 7 (VPS path)                                                            |
| **Mini App** | React 19 · TypeScript 5.8 · Vite 8 · Tailwind CSS 4 · Lucide icons           |
| **Infra**    | Docker Compose · Nginx · PM2 (VPS) · Cloudflare Cron Triggers                 |
| **CI/CD**    | GitHub Actions · Wrangler · custom deploy scripts                             |
| **Quality**  | ruff · mypy (strict) · pytest · Jest · ESLint                                 |
| **Security** | Bandit · pip-audit · GitLeaks / secret detection                              |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 22+
- `uv` package manager ([docs](https://docs.astral.sh/uv/))
- (Optional) Docker & Docker Compose for VPS path

### Local development (Python backend)

```bash
# Clone the repository
git clone https://github.com/alirezasafaei-dev/novax-price-alert.git
cd novax-price-alert

# Install dependencies and activate virtualenv
uv sync

# Copy environment template
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN and other required vars

# Run tests
uv run pytest

# Lint and type-check
uv run ruff check .
uv run mypy src
```

### Local development (Mini App)

```bash
cd mini-app
npm install
npm run dev
```

### Cloudflare Worker

```bash
cd deploy/cloudflare-worker
npm install
npm test
```

### Full stack with Docker Compose

```bash
docker compose -f docker-compose.ir-vps.yml up -d
```

---

## Testing

```bash
# Python tests (unit)
uv run pytest

# Python integration tests
uv run pytest tests/integration -m integration

# Mini App tests
cd mini-app && npm test

# Cloudflare Worker tests
cd deploy/cloudflare-worker && npm test

# Lint & type check
uv run ruff check . && uv run mypy src
```

CI runs all of the above on every push. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Deployment

| Path | Target | Method | Cron | DB |
|------|--------|--------|------|----|
| **Primary** | Cloudflare Workers + D1 | `wrangler deploy` | `0 * * * *` | D1 |
| **Fallback** | VPS (Docker Compose) | `docker compose up` | `0 * * * *` | PostgreSQL |
| **Fallback** (legacy) | VPS (PM2 bare‑metal) | `scripts/setup-vps.sh` | worker loop 3600s | PostgreSQL |

Full operational runbooks:
- [Cloudflare Worker + D1 operations](deploy/cloudflare-worker/README.md)
- [VPS deployment guide](docs/VPS_DEPLOYMENT.md)
- [Operations runbook](docs/OPERATIONS.md)

---

## Monitoring

- **Heartbeat** — GitHub Actions calls `GET /status` every 5 minutes; ops alerts via Telegram after 1800s cooldown
- **Health checks** — `GET /health` on FastAPI (Docker healthcheck, cloud monitoring)
- **Worker metrics** — alert execution logs, price staleness detection, cron heartbeat events

See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) for full observability setup.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | Real‑time implementation & production status |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Current architecture decisions |
| [`docs/API.md`](docs/API.md) | Backend API reference |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Cloudflare Worker & D1 operations runbook |
| [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) | Monitoring & debugging guide |
| [`docs/VPS_DEPLOYMENT.md`](docs/VPS_DEPLOYMENT.md) | Standalone VPS deployment |
| [`docs/CONTRACTS_AND_POLICIES.md`](docs/CONTRACTS_AND_POLICIES.md) | Domain contracts & invariants |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security controls & incident response |
| [`docs/USER_GUIDE_FA.md`](docs/USER_GUIDE_FA.md) | User guide (Persian) |
| [`SECURITY.md`](SECURITY.md) | Security policy & disclosure |
| [`SUPPORT.md`](SUPPORT.md) | Support channels |

---

## Project Structure

```
novax-price-alert/
├── src/novax_price_alert/     # Python backend (FastAPI, domain logic)
├── deploy/
│   ├── cloudflare-worker/     # Primary production path
│   ├── monitoring/            # Heartbeat & ops scripts
│   └── nginx/                 # Nginx configuration
├── mini-app/                  # React Telegram Mini App
├── tests/                     # Python tests
├── migrations/                # Alembic migrations (legacy)
├── scripts/                   # Deploy, backup, CI helpers
├── docs/                      # Documentation & ADRs
├── proxy/                     # Next.js proxy config (legacy)
├── docker-compose.ir-vps.yml  # VPS deployment stack
├── Dockerfile                 # Python backend container
├── pyproject.toml             # Python project config
└── SECURITY.md                # Security policy
```

---

## Security

- **Never commit secrets** — tokens, passwords, connection strings, or private keys
- If a secret is leaked: **rotate immediately** and **clean git history** — redacting the current file is not sufficient
- CI runs `pip-audit`, Bandit, and secret scanning on every push
- See [`SECURITY.md`](SECURITY.md) for full security policy and incident response

---

## Contributing

1. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/CONTRACTS_AND_POLICIES.md`](docs/CONTRACTS_AND_POLICIES.md)
2. Fork the repository
3. Create a feature branch: `git checkout -b feat/my-feature`
4. Make your changes — follow existing code style, keep imports clean, type strictly
5. Run `uv run ruff check . && uv run mypy src && uv run pytest` — all must pass
6. Open a pull request

Please report security issues privately per [`SECURITY.md`](SECURITY.md).

---

## License

[MIT](LICENSE) © Alireza Safaei
