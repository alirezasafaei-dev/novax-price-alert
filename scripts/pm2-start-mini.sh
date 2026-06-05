#!/bin/sh
set -e
cd /home/deploy/novax-price-alert/mini-app
export PATH="/home/deploy/.local/bin:$PATH"
set -a
if [ -f ../.env ]; then . ../.env; fi
if [ -f .env ]; then . ./.env; fi
set +a
# Default to 3002 to avoid port conflicts with other sites on this VPS
export PORT="${PORT:-3002}"
exec node dist/server.cjs
