# بات تلگرام هشدار قیمت نواکس

## 📊 وضعیت فعلی (۱۴۰۵/۰۳/۱۱)

### ✅ آماده و فعال
- **بات تلگرام**: `@novax_price_bot`
- **Cloudflare Worker**: `https://novax-telegram-relay.asdevelooper.workers.dev`
- **وضعیت**: Production و کار می‌کند
- **آخرین Commit**: `5b865d7` - نمایش قیمت ارزهای کوچک

---

## 🎯 قابلیت‌های فعلی

### 1. نمایش قیمت (✅ کار می‌کند)
- **کریپتو**: BTC, ETH, SOL, BNB — منبع: **Binance** — واحد: **USDT**
- **ارز**: دلار (USD)، یورو (EUR) — منبع: **TGJU** — واحد: **تومان**
- **طلا**: طلای ۱۸ عیار، سکه امامی — منبع: **TGJU** — واحد: **تومان**
- **به‌روزرسانی**: لحظه‌ای با تاریخ و ساعت تهران

### 2. سیستم هشدار (✅ کار می‌کند)
- **ذخیره**: Cloudflare KV
- **بررسی**: Cron job هر 10 دقیقه
- **اعلان**: پیام تلگرام به کاربر

### 3. منوی اصلی (✅ کار می‌کند)
- 💰 قیمت‌ها
- 🔔 تنظیم هشدار
- 📋 هشدارهای من
- ❓ راهنما

---

## ⚠️ مشکلات شناخته شده

موارد قبلی برطرف شده‌اند:
- ✅ فلوی هشدار کامل و مرحله‌ای شد (بازار → دارایی → شرط → قیمت → تایید) با دکمه‌ی بازگشت در هر مرحله.
- ✅ نرخ تبدیل ثابت حذف شد؛ ارز/طلا به‌صورت زنده از TGJU و کریپتو با واحد USDT از Binance خوانده می‌شود.
- ✅ retry/backoff برای کاهش خطای rate limit اضافه شد.

---

## 📁 ساختار پروژه

```
sites/secondary/bale-price-alert/
├── deploy/cloudflare-worker/
│   ├── src/
│   │   ├── index.js          # ورودی اصلی Worker
│   │   ├── telegram.js       # API تلگرام
│   │   ├── keyboards.js      # دکمه‌ها
│   │   ├── commands.js       # دستورات اصلی
│   │   ├── callbacks.js      # callback query handler
│   │   ├── sessions.js       # مدیریت session
│   │   ├── alerts.js         # مدیریت هشدارها
│   │   ├── prices.js         # دریافت قیمت از Binance (کریپتو) و TGJU (ارز/طلا)
│   │   └── cron.js           # Cron job
│   ├── wrangler.toml         # تنظیمات Cloudflare
│   └── package.json
├── proxy/                    # Proxy آماده (برای آینده)
│   ├── price-proxy.js
│   ├── package.json
│   └── README.md
├── docs/
│   ├── PROGRESS.md           # گزارش پیشرفت
│   └── telegram_bot_technical_plan.md
├── .env                      # Secrets (هرگز commit نشود)
└── README.md                 # این فایل
```

---

## 🚀 دستورات مهم

### دیپلوی به Cloudflare
```bash
cd deploy/cloudflare-worker
export CLOUDFLARE_API_TOKEN=<YOUR_CLOUDFLARE_API_TOKEN>
export CLOUDFLARE_ACCOUNT_ID=<YOUR_CLOUDFLARE_ACCOUNT_ID>
npx wrangler deploy
```

### مشاهده لاگ زنده
```bash
cd deploy/cloudflare-worker
export CLOUDFLARE_API_TOKEN=<YOUR_CLOUDFLARE_API_TOKEN>
export CLOUDFLARE_ACCOUNT_ID=<YOUR_CLOUDFLARE_ACCOUNT_ID>
npx wrangler tail --format pretty
```

### تنظیم Webhook
```bash
cd /home/dev13/my-project/sites/secondary/bale-price-alert
source .env
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://novax-telegram-relay.asdevelooper.workers.dev/webhook\",\"secret_token\":\"${TELEGRAM_SECRET_TOKEN}\",\"allowed_updates\":[\"message\",\"edited_message\",\"callback_query\"]}"
```

### بررسی وضعیت Webhook
```bash
source .env
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
```

---

## 🔧 تنظیمات محیط

### متغیرهای .env
```bash
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>
TELEGRAM_SECRET_TOKEN=<YOUR_TELEGRAM_SECRET_TOKEN>
CLOUDFLARE_API_TOKEN=<YOUR_CLOUDFLARE_API_TOKEN>
CLOUDFLARE_ACCOUNT_ID=<YOUR_CLOUDFLARE_ACCOUNT_ID>
```

### KV Namespaces در Cloudflare
- `ALERTS_KV`: 9bfa7672e25d446aa0a24165cbd1848a
- `SESSIONS_KV`: 9bfa7672e25d446aa0a24165cbd1848a
- `USERS_KV`: 9bfa7672e25d446aa0a24165cbd1848a

---

## 📋 وضعیت تکمیل (مطابق USER_GUIDE)

### ✅ انجام‌شده
- [x] فلوی ۵مرحله‌ای هشدار (بازار → دارایی → شرط → قیمت → تایید) با دکمه‌ی بازگشت
- [x] کریپتو BTC/ETH/SOL/BNB از Binance با واحد USDT
- [x] ارز (USD + EUR) و طلا (۱۸ عیار + سکه امامی) از TGJU به تومان
- [x] «هشدارهای من» با قیمت فعلی + دکمه‌ی 🗑 حذف برای هر هشدار
- [x] بررسی هشدار با Cron هر ۱۰ دقیقه (تست زنده تأیید شد)
- [x] retry/backoff برای خطاهای شبکه/rate limit

### 🔮 بهبودهای اختیاری آینده
- [ ] اضافه کردن metrics/مانیتورینگ
- [ ] نمایش تاریخچه‌ی قیمت
- [ ] دارایی‌ها/بازارهای بیشتر

---

## 🐛 عیب‌یابی

### دکمه‌ها کار نمی‌کنند
1. بررسی لاگ: `npx wrangler tail --format pretty`
2. بررسی webhook: `curl .../getWebhookInfo`
3. بررسی session: ممکن است session قدیمی باشد

### قیمت‌ها نمایش داده نمی‌شوند
1. بررسی لاگ برای خطای Binance یا TGJU
2. تست کریپتو (Binance): `curl "https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT"`
3. تست ارز/طلا (TGJU، با fallback): `curl "https://call2.tgju.org/ajax.json"`

### هشدارها کار نمی‌کنند
1. بررسی cron log: `npx wrangler tail` و منتظر cron بمانید
2. بررسی KV: آیا هشدار ذخیره شده؟
3. بررسی قیمت: آیا شرط برآورده شده؟

---

## 📝 نکات مهم برای ادامه کار

### قبل از شروع
1. بررسی آخرین commit: `git log -1 --oneline`
2. خواندن `docs/PROGRESS.md`
3. بررسی وضعیت production: تست بات در تلگرام

### هنگام تغییرات
1. تست local (اگر ممکن است)
2. دیپلوی به Cloudflare
3. تست در تلگرام
4. بررسی لاگ
5. Commit با پیام واضح

### بعد از تکمیل
1. به‌روزرسانی `docs/PROGRESS.md`
2. به‌روزرسانی این README
3. Commit و Push
4. تست نهایی

---

## 🔗 لینک‌های مفید

- **بات تلگرام**: https://t.me/novax_price_bot
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Binance API**: https://data-api.binance.vision
- **TGJU**: https://www.tgju.org
- **Telegram Bot API**: https://core.telegram.org/bots/api

---

## 📞 اطلاعات تماس

- **VPS**: 185.3.124.93 (SSH فعلاً بسته است)
- **Cloudflare Account**: <YOUR_CLOUDFLARE_ACCOUNT_ID>
- **Bot Username**: @novax_price_bot

---

**وضعیت**: Production - کامل و مطابق USER_GUIDE ✅ (کریپتو Binance/USDT، ارز و طلا TGJU/تومان)
