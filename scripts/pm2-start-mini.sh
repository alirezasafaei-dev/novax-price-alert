#!/bin/sh
set -e
cd /home/deploy/novax-price-alert/mini-app
export PATH="/home/deploy/.local/bin:$PATH"
set -a
if [ -f ../.env ]; then . ../.env; fi
if [ -f .env ]; then . ./.env; fi
set +a
# Production default for novax-mini-app; 3000/3002 are used by sibling sites.
export PORT="${NOVAX_MINI_PORT:-3012}"
exec node dist/server.cjs
