#!/bin/bash
TOKEN=*** "^TELEGRAM_BOT_TOKEN=*** /home/dev13/my-project/sites/secondary/novax-price-alert/.env | head -1 | sed 's/.*=//'

echo "=== 1. Telegram Bot Info ==="
curl -s "https://api.telegram.org/bot${TOKEN}/getMe"
echo ""

echo "=== 2. Webhook Info ==="
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
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
