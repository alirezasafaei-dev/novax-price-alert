#!/bin/sh
set -e
cd /home/deploy/novax-price-alert
export PATH="/home/deploy/.local/bin:$PATH"
. ./scripts/load-dotenv-safe.sh
load_dotenv_safe .env
exec uv run uvicorn src.novax_price_alert.api.main:app --host 0.0.0.0 --port 8001
