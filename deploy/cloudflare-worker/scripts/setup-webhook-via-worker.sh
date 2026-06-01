#!/usr/bin/env bash
set -euo pipefail

# این اسکریپت از طریق یک Cloudflare Worker دیگر webhook را تنظیم می‌کند

WORKER_URL="https://novax-telegram-relay.asdevelooper.workers.dev/webhook"
BOT_TOKEN="<YOUR_TELEGRAM_BOT_TOKEN>"
SECRET_TOKEN="<YOUR_TELEGRAM_SECRET_TOKEN>"

# استفاده از یک proxy عمومی یا worker دیگر
TELEGRAM_API="https://api.telegram.org/bot${BOT_TOKEN}"

echo "تنظیم webhook از طریق Cloudflare Worker..."
echo ""
echo "URL: ${WORKER_URL}"
echo "Bot: @novax_price_bot"
echo ""

# ساخت worker موقت برای تنظیم webhook
cat > /tmp/webhook-setter.js << 'WORKER_EOF'
export default {
  async fetch(request) {
    const botToken = "<YOUR_TELEGRAM_BOT_TOKEN>";
    const webhookUrl = "https://novax-telegram-relay.asdevelooper.workers.dev/webhook";
    const secretToken = "<YOUR_TELEGRAM_SECRET_TOKEN>";
    
    const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken
      })
    });
    
    const result = await response.json();
    return Response.json(result);
  }
}
WORKER_EOF

echo "Worker موقت ساخته شد: /tmp/webhook-setter.js"
echo ""
echo "برای تنظیم webhook:"
echo "1. این worker را دیپلوی کنید"
echo "2. یک بار آن را فراخوانی کنید"
echo "3. worker را حذف کنید"
echo ""
echo "یا از Cloudflare Dashboard → Workers → Quick Edit استفاده کنید"
