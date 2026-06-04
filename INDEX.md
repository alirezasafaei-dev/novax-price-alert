# Project Index

## Start Here

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [docs/README.md](docs/README.md)
- [docs/PROGRESS.md](docs/PROGRESS.md)

## Active Documentation

- [docs/QUICK_START_FA.md](docs/QUICK_START_FA.md)
- [docs/USER_GUIDE_FA.md](docs/USER_GUIDE_FA.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API.md](docs/API.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)
- [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)
- [docs/IMPLEMENTATION_ROADMAP_FA.md](docs/IMPLEMENTATION_ROADMAP_FA.md)

## Durable Decisions

- [docs/adr/0001-alert-source-of-truth.md](docs/adr/0001-alert-source-of-truth.md)
- [docs/adr/0002-cron-heartbeat-monitor-placement.md](docs/adr/0002-cron-heartbeat-monitor-placement.md)

## Code Areas

- `src/novax_price_alert/` application code
- `deploy/cloudflare-worker/` Telegram relay and cron handling
- `migrations/` database schema changes
- `tests/` automated verification

## Current Reality

- Production bot is live.
- Alert creation is staged and confirmed explicitly.
- Crypto pricing uses Binance.
- Fiat and gold pricing use TGJU.
- The active docs set is intentionally small.
