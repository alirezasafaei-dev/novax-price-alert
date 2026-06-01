#!/usr/bin/env bash
set -euo pipefail

# این اسکریپت را از خارج محیط (روی سیستم با دسترسی اینترنت) اجرا کنید

WORKER_URL="${WORKER_URL:-https://novax-telegram-relay.asdevelooper.workers.dev}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?set TELEGRAM_BOT_TOKEN (e.g. via 'source .env')}"
SECRET_TOKEN="${TELEGRAM_SECRET_TOKEN:?set TELEGRAM_SECRET_TOKEN (e.g. via 'source .env')}"

echo "Setting webhook..."
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WORKER_URL}/webhook\",\"secret_token\":\"${SECRET_TOKEN}\"}"

echo -e "\n\nChecking webhook info..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .

echo -e "\n\nWebhook configured!"
echo "Bot: @novax_price_bot"
echo "Webhook: ${WORKER_URL}/webhook"
