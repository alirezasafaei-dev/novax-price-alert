#!/bin/sh
set -e
cd /home/deploy/novax-price-alert
export PATH="/home/deploy/.local/bin:$PATH"
set -a
if [ -f .env ]; then . ./.env; fi
set +a
exec uv run python -m novax_price_alert.worker_main
