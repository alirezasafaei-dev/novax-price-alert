#!/bin/sh
set -e
cd /home/deploy/novax-price-alert
export PATH="/home/deploy/.local/bin:$PATH"
set -a
if [ -f .env ]; then . ./.env; fi
set +a
exec uv run uvicorn src.novax_price_alert.api.main:app --host 0.0.0.0 --port 8001
