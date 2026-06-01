# راهنمای تنظیم Webhook

## وضعیت فعلی

✅ Worker دیپلوی شده: `https://novax-telegram-relay.asdevelooper.workers.dev`
✅ KV Namespaces متصل شده
✅ Secrets آپلود شده
✅ Cron فعال: هر 10 دقیقه

⚠️ Webhook هنوز تنظیم نشده (به دلیل محدودیت شبکه در محیط)

## تنظیم Webhook

از یک سیستم با دسترسی اینترنت این دستور را اجرا کنید:

```bash
cd sites/secondary/bale-price-alert/deploy/cloudflare-worker
./scripts/set-webhook.sh
```

یا به صورت دستی:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://novax-telegram-relay.asdevelooper.workers.dev/webhook","secret_token":"<YOUR_TELEGRAM_SECRET_TOKEN>"}'
```

## بررسی وضعیت Webhook

```bash
curl -s "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/getWebhookInfo" | jq .
```

انتظار:

```json
{
  "ok": true,
  "result": {
    "url": "https://novax-telegram-relay.asdevelooper.workers.dev/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40
  }
}
```

## تست بات در تلگرام

1. در تلگرام جستجو کنید: `@novax_price_bot`
2. دکمه Start را بزنید
3. باید منوی دکمه‌ای ببینید:
   ```
   [ 💰 قیمت‌ها ]      [ 🔔 تنظیم هشدار ]
   [ 📋 هشدارهای من ] [ ❓ راهنما ]
   ```

## تست فلوی هشدار

1. روی `🔔 تنظیم هشدار` کلیک کنید
2. بازار را انتخاب کنید (مثلاً کریپتو)
3. دارایی را انتخاب کنید (مثلاً BTC)
4. شرط را انتخاب کنید (بالاتر از / پایین‌تر از)
5. قیمت هدف را وارد کنید (مثلاً 1)
6. تایید کنید
7. بعد از حداکثر 10 دقیقه باید پیام هشدار دریافت کنید

## مشاهده لاگ‌ها

```bash
npx wrangler tail
```

## اطلاعات بات

- Username: `@novax_price_bot`
- Worker URL: `https://novax-telegram-relay.asdevelooper.workers.dev`
- Webhook: `https://novax-telegram-relay.asdevelooper.workers.dev/webhook`
- Health Check: `https://novax-telegram-relay.asdevelooper.workers.dev/health`
