#!/bin/bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-}"

if [[ -z "${TOKEN}" ]]; then
  echo "TELEGRAM_BOT_TOKEN is not set; skipping Telegram checks"
fi

echo "=== 1. Telegram Bot Info ==="
if [[ -n "${TOKEN}" ]]; then
  curl -s "https://api.telegram.org/bot${TOKEN}/getMe"
fi
echo ""

echo "=== 2. Webhook Info ==="
if [[ -n "${TOKEN}" ]]; then
  curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
fi
echo ""

echo "=== 3. Backend Health ==="
curl -s --connect-timeout 3 http://localhost:8000/health 2>&1 || echo "NOT RUNNING"

echo ""
echo "=== 4. Backend Prices ==="
curl -s --connect-timeout 3 http://localhost:8000/api/v1/prices/latest 2>&1 || echo "NOT RUNNING"

echo ""
echo "=== 5. Auth Check ==="
curl -s --connect-timeout 3 -o /dev/null -w "Alerts HTTP %{http_code}" http://localhost:8000/api/v1/alerts 2>&1 || echo "NOT RUNNING"

echo ""
echo "=== DONE ==="
