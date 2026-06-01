# Iran Market Price Alert

Self-hostable backend for an Iran-market Telegram Mini App price alert product.

## 🚀 Live Telegram Bot

The bot is live and ready to use: **[@novax_price_bot](https://t.me/novax_price_bot)**

### Quick Start for Users

- **Persian Guide**: See [`docs/QUICK_START_FA.md`](docs/QUICK_START_FA.md) for user instructions
- **User Manual**: See [`docs/USER_GUIDE_FA.md`](docs/USER_GUIDE_FA.md) for detailed commands
- **Production Status**: See [`docs/PRODUCTION_CHECKLIST_FA.md`](docs/PRODUCTION_CHECKLIST_FA.md) for verification

## Overview

This service provides:

- Telegram Mini App `initData` verification
- Telegram user persistence
- Iran-market price fetching with Nerkh free-key provider, TGJU no-key scraping fallback, AlanChand, API.ir, and Bonbast failover
- latest price and optional snapshot storage
- alert CRUD for Telegram users
- 60-second background price fetch and alert evaluation
- Telegram Bot API notifications

## Stack

- Python 3.10+
- FastAPI
- SQLAlchemy 2.x async
- Alembic
- PostgreSQL in production, SQLite for tests/local fallback
- Redis-compatible cache settings
- httpx, Pydantic v2, pydantic-settings
- pytest, Ruff, MyPy

## Quick Start

```bash
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m novax_price_alert.scripts.seed_mvp
uv run uvicorn novax_price_alert.api.main:app --host 127.0.0.1 --port 8000
```

Worker:

```bash
uv run python -m novax_price_alert.worker_main
```

## MVP Assets

- `USD_IRT` — دلار آزاد
- `GOLD_18K_IRT` — طلای ۱۸ عیار
- `SEKKEH_EMAMI_IRT` — سکه امامی
- `USDT_IRT` — تتر

All displayed user prices are Iran-market prices. Global market APIs are not primary sources.

## API Auth

TWA-authenticated routes require:

```text
X-Telegram-Init-Data: <Telegram.WebApp.initData>
```

The backend validates the Telegram hash using `TELEGRAM_BOT_TOKEN`, checks freshness, and upserts the user.

## Quality

```bash
uv run pytest
uv run ruff check .
uv run mypy src
```

## Data Source Order

1. Nerkh API when `NERKH_API_KEY` is configured
2. TGJU no-key HTML fallback with conservative scraping and caching
3. AlanChand API when `ALANCHAND_API_TOKEN` is configured
4. API.ir when account endpoint/key are configured
5. Bonbast failover only

Provider values are normalized to internal `IRT` asset symbols before persistence and alert matching.

Nerkh advertises free access, but its official OpenAPI currently requires `x-api-key` or Bearer auth for price endpoints. No API key is hardcoded in this repository.

TGJU scraping is used only as a no-key resilience layer and should be cached aggressively to reduce request volume.
