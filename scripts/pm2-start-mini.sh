#!/bin/sh
set -e
cd /home/deploy/novax-price-alert/mini-app
export PATH="/home/deploy/.local/bin:$PATH"
. ../scripts/load-dotenv-safe.sh
load_dotenv_safe ../.env
load_dotenv_safe .env
# Production default for novax-mini-app; 3000/3002 are used by sibling sites.
export PORT="${NOVAX_MINI_PORT:-3012}"
exec node dist/server.cjs
