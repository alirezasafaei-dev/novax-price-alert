# وضعیت پروژه بات تلگرام نواکس

## ✅ کارهای انجام شده

### 1. معماری و کد
- ✅ ساختار modular در `src/` با 9 ماژول جداگانه
- ✅ Reply Keyboard برای منوی اصلی
- ✅ Inline Keyboard برای انتخاب‌ها و wizard
- ✅ Session management با KV
- ✅ Alert CRUD operations
- ✅ Price providers: Binance (crypto) + TGJU (fiat/gold)
- ✅ Cron job برای بررسی هشدارها (هر 10 دقیقه)
- ✅ Duplicate update prevention
- ✅ Webhook secret token validation

### 2. دیپلویمنت
- ✅ Worker دیپلوی شده: `https://novax-telegram-relay.asdevelooper.workers.dev`
- ✅ KV Namespaces متصل: ALERTS_KV, SESSIONS_KV, USERS_KV
- ✅ Secrets آپلود شده: TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN
- ✅ Cron trigger فعال: `*/10 * * * *`
- ✅ اسکریپت دیپلوی خودکار: `scripts/deploy.sh`
- ✅ اسکریپت تنظیم webhook: `scripts/set-webhook.sh`

### 3. مستندات
- ✅ راهنمای کامل کاربر فارسی: `docs/USER_GUIDE_COMPLETE_FA.md`
- ✅ چک‌لیست تست 17 مرحله‌ای: `docs/FINAL_TEST_CHECKLIST_FA.md`
- ✅ راهنمای تنظیم webhook: `deploy/cloudflare-worker/WEBHOOK_SETUP.md`
- ✅ مستند فنی اجرایی: `/home/dev13/my-project/docs/telegram_bot_technical_plan.md`

### 4. تست
- ✅ Unit test ساختار جدید: `test/new-bot.test.mjs` (passed)

## ⚠️ کار باقی‌مانده

### تنظیم Webhook (نیاز به اینترنت)

از یک سیستم با دسترسی اینترنت اجرا کنید:

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

## 🧪 تست در تلگرام

بعد از تنظیم webhook:

1. در تلگرام جستجو کنید: `@novax_price_bot`
2. Start را بزنید
3. منوی دکمه‌ای را ببینید
4. قیمت‌ها را مشاهده کنید
5. هشدار تنظیم کنید
6. بعد از 10 دقیقه پیام هشدار دریافت کنید

## 📊 معماری نهایی

```
Telegram User
  ↓
@novax_price_bot
  ↓ Webhook
Cloudflare Worker (novax-telegram-relay)
  ├── src/index.js (webhook handler + cron)
  ├── src/commands.js (start, help, prices, alerts)
  ├── src/callbacks.js (inline buttons + wizard)
  ├── src/keyboards.js (reply + inline keyboards)
  ├── src/sessions.js (KV session management)
  ├── src/alerts.js (CRUD operations)
  ├── src/prices.js (Binance + TGJU)
  ├── src/telegram.js (API wrapper)
  └── src/cron.js (alert evaluation)
  ↓
KV Storage
  ├── ALERTS_KV (user alerts)
  ├── SESSIONS_KV (wizard state)
  ├── USERS_KV (user profiles)
  └── processed_update:{id} (deduplication)
```

## 🎯 امکانات بات

### منوی اصلی (Reply Keyboard)
```
[ 💰 قیمت‌ها ]      [ 🔔 تنظیم هشدار ]
[ 📋 هشدارهای من ] [ ❓ راهنما ]
```

### بازارهای پشتیبانی شده
- **کریپتو**: BTC, ETH, SOL, BNB (از Binance)
- **ارز**: USD, EUR (از TGJU)
- **طلا**: طلای 18 عیار, سکه امامی (از TGJU)

### فلوی تنظیم هشدار
1. انتخاب بازار (کریپتو/ارز/طلا)
2. انتخاب دارایی (BTC/USD/GOLD/...)
3. انتخاب شرط (بالاتر از / پایین‌تر از)
4. ورود قیمت هدف
5. تایید و ذخیره

### ارسال هشدار
- بررسی خودکار هر 10 دقیقه
- ارسال پیام به کاربر در صورت برقراری شرط
- غیرفعال شدن خودکار بعد از ارسال

## 📁 فایل‌های کلیدی

```
sites/secondary/bale-price-alert/
├── deploy/cloudflare-worker/
│   ├── src/
│   │   ├── index.js          # Entry point
│   │   ├── commands.js       # Command handlers
│   │   ├── callbacks.js      # Callback handlers + wizard
│   │   ├── keyboards.js      # Keyboard definitions
│   │   ├── sessions.js       # Session management
│   │   ├── alerts.js         # Alert operations
│   │   ├── prices.js         # Price providers
│   │   ├── telegram.js       # Telegram API
│   │   └── cron.js           # Cron job
│   ├── scripts/
│   │   ├── deploy.sh         # Full deployment
│   │   └── set-webhook.sh    # Webhook setup only
│   ├── wrangler.toml         # Worker config
│   ├── WEBHOOK_SETUP.md      # Setup guide
│   └── test/
│       └── new-bot.test.mjs  # Unit test
├── docs/
│   ├── USER_GUIDE_COMPLETE_FA.md      # User manual
│   └── FINAL_TEST_CHECKLIST_FA.md     # Test cases
└── .env                      # Secrets (not committed)
```

## 🔐 Secrets

در `.env`:
```
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>
TELEGRAM_SECRET_TOKEN=<YOUR_TELEGRAM_SECRET_TOKEN>
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

## 🚀 دستورات مفید

```bash
# دیپلوی کامل
cd deploy/cloudflare-worker
./scripts/deploy.sh

# فقط تنظیم webhook (از خارج محیط)
./scripts/set-webhook.sh

# بررسی webhook
curl -s "https://api.telegram.org/bot{TOKEN}/getWebhookInfo" | jq .

# مشاهده لاگ‌ها
npx wrangler tail

# تست
node test/new-bot.test.mjs
```

## 📈 وضعیت Production

- **Bot Username**: @novax_price_bot
- **Worker URL**: https://novax-telegram-relay.asdevelooper.workers.dev
- **Webhook**: https://novax-telegram-relay.asdevelooper.workers.dev/webhook
- **Health Check**: https://novax-telegram-relay.asdevelooper.workers.dev/health
- **Cron**: هر 10 دقیقه
- **KV Namespace ID**: 9bfa7672e25d446aa0a24165cbd1848a

## ✨ ویژگی‌های پیاده‌سازی شده

- ✅ منوی دکمه‌ای تعاملی
- ✅ Wizard چندمرحله‌ای برای تنظیم هشدار
- ✅ Session management برای حفظ وضعیت مکالمه
- ✅ Duplicate update prevention
- ✅ Webhook secret validation
- ✅ قیمت‌های real-time از Binance و TGJU
- ✅ فرمت فارسی اعداد با کاما
- ✅ زمان تهران برای قیمت‌های ایران
- ✅ Cron job برای بررسی خودکار هشدارها
- ✅ غیرفعال شدن خودکار هشدار بعد از trigger
- ✅ مدیریت هشدارها (لیست، حذف)
- ✅ Error handling و validation

## 🎉 آماده برای استفاده

بات کاملاً پیاده‌سازی شده و آماده استفاده است. فقط webhook را تنظیم کنید و شروع کنید!

---

**تاریخ**: 1 خرداد 1405  
**نسخه**: 1.0.0  
**وضعیت**: Production Ready (نیاز به تنظیم webhook)
