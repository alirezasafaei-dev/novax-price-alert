#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f ../../.env ]]; then
  echo "Error: .env file not found"
  exit 1
fi

set -a
source ../../.env
set +a

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "Error: TELEGRAM_BOT_TOKEN not set"
  exit 1
fi

if [[ -z "${TELEGRAM_SECRET_TOKEN:-}" ]]; then
  echo "Generating TELEGRAM_SECRET_TOKEN..."
  TELEGRAM_SECRET_TOKEN=$(openssl rand -hex 32)
  echo "TELEGRAM_SECRET_TOKEN=$TELEGRAM_SECRET_TOKEN" >> ../../.env
  echo "Generated and saved to .env"
fi

echo "Uploading secrets..."
printf '%s' "$TELEGRAM_BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "$TELEGRAM_SECRET_TOKEN" | npx wrangler secret put TELEGRAM_SECRET_TOKEN

echo "Deploying worker..."
npx wrangler deploy

echo "Setting webhook..."
WORKER_URL="https://novax-telegram-relay.asdevelooper.workers.dev"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WORKER_URL}/webhook\",\"secret_token\":\"${TELEGRAM_SECRET_TOKEN}\"}"

echo -e "\n\nDeployment complete!"
echo "Webhook: ${WORKER_URL}/webhook"
