#!/usr/bin/env bash
set -euo pipefail

# این اسکریپت را از خارج محیط (روی سیستم با دسترسی اینترنت) اجرا کنید

WORKER_URL="https://novax-telegram-relay.asdevelooper.workers.dev"
BOT_TOKEN="<YOUR_TELEGRAM_BOT_TOKEN>"
SECRET_TOKEN="<YOUR_TELEGRAM_SECRET_TOKEN>"

echo "Setting webhook..."
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WORKER_URL}/webhook\",\"secret_token\":\"${SECRET_TOKEN}\"}"

echo -e "\n\nChecking webhook info..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .

echo -e "\n\nWebhook configured!"
echo "Bot: @novax_price_bot"
echo "Webhook: ${WORKER_URL}/webhook"
