#!/bin/sh
set -e
cd /home/deploy/novax-price-alert
export PATH="/home/deploy/.local/bin:$PATH"
. ./scripts/load-dotenv-safe.sh
load_dotenv_safe .env
exec uv run python -m novax_price_alert.worker_main
