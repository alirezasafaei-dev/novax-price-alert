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
- **ارزها**: USDT, DOGE, SHIB, TRX, ADA, DOT
- **منبع**: CoinGecko API
- **واحد**: تومان (نرخ: 1 USD = 175,000 تومان)
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

1. **فلوی هشدار ناقص**
   - کاربر می‌تواند بدون انتخاب کامل (بازار/دارایی/شرط) عدد بفرستد
   - هشدارها با مقادیر نادرست ذخیره می‌شوند

2. **نرخ تبدیل ثابت**
   - نرخ دلار به تومان ثابت: 175,000
   - نیاز به API واقعی یا به‌روزرسانی دستی

3. **Rate limit گاهی**
   - دکمه‌ها گاهی نیاز به چند بار تلاش دارند

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
│   │   ├── prices.js         # دریافت قیمت از CoinGecko
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

## 📋 TODO - مراحل بعدی

### فاز 1: اصلاح فلوی هشدار (اولویت بالا)
- [ ] اجباری کردن انتخاب کامل (بازار → دارایی → شرط → قیمت)
- [ ] اضافه کردن دکمه "لغو" در هر مرحله
- [ ] نمایش پیشرفت (مثلاً: "مرحله 2 از 4")
- [ ] جلوگیری از ارسال عدد قبل از تکمیل مراحل

**فایل‌های مرتبط:**
- `src/callbacks.js` - handleTextInSession
- `src/keyboards.js` - اضافه کردن دکمه لغو

### فاز 2: بهبود نرخ تبدیل (اولویت متوسط)
**گزینه A: استفاده از API واقعی**
- [ ] پیدا کردن API قابل اعتماد برای نرخ دلار به تومان
- [ ] اضافه کردن fallback به نرخ ثابت

**گزینه B: راه‌اندازی Proxy در VPS**
- [ ] باز کردن SSH در VPS (185.3.124.93)
- [ ] نصب proxy از پوشه `proxy/`
- [ ] تغییر `src/prices.js` برای استفاده از proxy

**فایل‌های مرتبط:**
- `src/prices.js` - USD_TO_TOMAN

### فاز 3: بهینه‌سازی UX (اولویت پایین)
- [ ] اضافه کردن loading indicator
- [ ] بهبود پیام‌های خطا
- [ ] اضافه کردن دکمه "تنظیم سریع هشدار"
- [ ] نمایش تاریخچه قیمت (اختیاری)

### فاز 4: مانیتورینگ و تست
- [ ] تست کامل cron job
- [ ] تست rate limit handling
- [ ] اضافه کردن metrics (اختیاری)
- [ ] تست با چند کاربر همزمان

---

## 🐛 عیب‌یابی

### دکمه‌ها کار نمی‌کنند
1. بررسی لاگ: `npx wrangler tail --format pretty`
2. بررسی webhook: `curl .../getWebhookInfo`
3. بررسی session: ممکن است session قدیمی باشد

### قیمت‌ها نمایش داده نمی‌شوند
1. بررسی لاگ برای خطای CoinGecko
2. تست API مستقیم: `curl "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd" -H "User-Agent: Novax-Price-Bot/1.0"`
3. بررسی rate limit CoinGecko

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
- **CoinGecko API**: https://www.coingecko.com/en/api
- **Telegram Bot API**: https://core.telegram.org/bots/api

---

## 📞 اطلاعات تماس

- **VPS**: 185.3.124.93 (SSH فعلاً بسته است)
- **Cloudflare Account**: <YOUR_CLOUDFLARE_ACCOUNT_ID>
- **Bot Username**: @novax_price_bot

---

**آخرین به‌روزرسانی**: ۱۴۰۵/۰۳/۱۱ ۲۱:۲۰
**وضعیت**: Production - کار می‌کند ✅
