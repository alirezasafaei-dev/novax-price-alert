#!/usr/bin/env bash
set -euo pipefail

# این اسکریپت از طریق یک Cloudflare Worker دیگر webhook را تنظیم می‌کند

WORKER_URL="${WORKER_URL:-https://novax-telegram-relay.asdevelooper.workers.dev/webhook}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?set TELEGRAM_BOT_TOKEN (e.g. via 'source .env')}"
SECRET_TOKEN="${TELEGRAM_SECRET_TOKEN:?set TELEGRAM_SECRET_TOKEN (e.g. via 'source .env')}"

# استفاده از یک proxy عمومی یا worker دیگر
TELEGRAM_API="https://api.telegram.org/bot${BOT_TOKEN}"

echo "تنظیم webhook از طریق Cloudflare Worker..."
echo ""
echo "URL: ${WORKER_URL}"
echo "Bot: @novax_price_bot"
echo ""

# ساخت worker موقت برای تنظیم webhook
# توکن‌ها از محیط جایگذاری می‌شوند (هرگز در فایل هاردکد نکنید)
cat > /tmp/webhook-setter.js << WORKER_EOF
export default {
  async fetch(request) {
    const botToken = "${BOT_TOKEN}";
    const webhookUrl = "${WORKER_URL}";
    const secretToken = "${SECRET_TOKEN}";
    
    const telegramUrl = \`https://api.telegram.org/bot\${botToken}/setWebhook\`;
    
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
