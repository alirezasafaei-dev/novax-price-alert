# راهنمای اجرای Telegram-Only بدون VPS

**تاریخ**: 2026-06-14
**وضعیت**: راهنمای عملیاتی
**هدف**: اجرای بات تلگرام نواکس فقط با Cloudflare Workers، بدون نیاز به VPS

---

## 🎯 هدف

اجرای بات تلگرام **@novax_price_bot** به صورت کاملاً serverless با استفاده از:
- **Cloudflare Workers**: برای webhook relay و منطق بات
- **Telegram API**: برای ارتباط مستقیم با کاربران
- **TGJU API**: برای دریافت قیمت‌های لحظه‌ای

**بدون نیاز به:**
- ❌ VPS
- ❌ Database
- ❌ Backend FastAPI
- ❌ Mini-app React

---

## 📋 پیش‌نیازها

### 1. حساب Cloudflare
- حساب Cloudflare Workers (رایگان تا 100,000 request/day)
- Wrangler CLI نصب شده: `npm install -g wrangler`

### 2. بات تلگرام
- Bot Token از @BotFather
- اطلاعات بات: @novax_price_bot (ID: 8858674032)

### 3. ابزارهای محلی
- Node.js 18+ نصب شده
- دسترسی به terminal

---

## 🏗️ معماری Telegram-Only

```
User (Telegram)
    ↓
Telegram Servers
    ↓ [webhook]
Cloudflare Worker (novax-telegram-relay)
    ├─ Handle /start, /help, /prices
    ├─ Fetch prices from TGJU
    ├─ Manage alerts in KV storage
    └─ Send responses via Telegram API
```

**ویژگی‌ها:**
- ✅ Serverless (بدون VPS)
- ✅ Global edge deployment (سرعت بالا)
- ✅ Scale خودکار
- ✅ هزینه صفر تا 100k request/day
- ✅ دسترسی از ایران (Cloudflare فیلتر نیست)

---

## 🚀 راهنمای اجرای سریع

### مرحله 1: آماده‌سازی محیط

```bash
# رفتن به دایرکتوری worker
cd /home/dev13/my-project/sites/secondary/novax-price-alert/deploy/cloudflare-worker

# نصب dependencies
npm install

# لاگین به Cloudflare
npx wrangler login
```

### مرحله 2: تنظیم Secrets

```bash
# تنظیم Bot Token
npx wrangler secret put TELEGRAM_BOT_TOKEN
# وارد کنید: <BOT_TOKEN شما از @BotFather>

# تنظیم Relay Secret (برای امنیت - اختیاری)
npx wrangler secret put RELAY_SECRET
# وارد کنید: یک string تصادفی مثل: "my-secret-key-12345"
```

### مرحله 3: Deploy Worker

```bash
# Deploy به Cloudflare
npx wrangler deploy

# خروجی شبیه این خواهد بود:
# Published novax-telegram-relay (X.XX sec)
# https://novax-telegram-relay.<your-subdomain>.workers.dev
```

**نکته**: آدرس worker را یادداشت کنید.

### مرحله 4: اتصال Webhook تلگرام

```bash
# جایگزین کنید <WORKER_URL> را با آدرس worker خود
export WORKER_URL=https://novax-telegram-relay.<your-subdomain>.workers.dev

# تنظیم webhook و commands
curl "${WORKER_URL}/setup-bot"
```

**انتظار:** پاسخ JSON با `ok: true`

### مرحله 5: تست بات

1. در تلگرام به @novax_price_bot پیام دهید
2. دستور `/start` را ارسال کنید
3. دستور `/help` برای لیست دستورات
4. دستور `/prices` برای دیدن قیمت‌های لحظه‌ای

---

## 📝 دستورات بات

### دستورات اصلی
- `/start` - شروع و معرفی بات
- `/help` - راهنمای استفاده
- `/prices` - نمایش قیمت‌های لحظه‌ای

### مدیریت هشدار (Alert Management)
```bash
# ایجاد هشدار
/alert USD 170000 above    # هشدار وقتی دلار بالای 170,000 تومان رفت
/alert USDT 175000 below   # هشدار وقتی تتر زیر 175,000 تومان آمد
/alert GOLD 18000000 above # هشدار وقتی طلا بالای 18,000,000 تومان رفت

# مشاهده هشدارهای فعال
/alerts

# حذف هشدار
/delete <alert_id>
```

### نمادهای پشتیبانی شده
- `USD` / `DOLLAR` - دلار آزاد (تومان)
- `USDT` / `TETHER` - تتر (تومان)
- `GOLD` / `18K` - طلای 18 عیار (تومان)
- `SEKKEH` / `COIN` - سکه امامی (تومان)

---

## 🔧 تنظیمات پیشرفته

### فعال‌سازی KV Storage (برای ذخیره هشدارها)

```bash
# ایجاد KV namespace
npx wrangler kv:namespace create ALERTS_KV

# خروجی را کپی کنید و به wrangler.toml اضافه کنید:
# [[kv_namespaces]]
# binding = "ALERTS_KV"
# id = "<KV_ID از خروجی قبلی>"

# Deploy مجدد
npx wrangler deploy
```

**بدون KV**: هشدارها در cache موقت ذخیره می‌شوند (محدود به یک ساعت)

### تنظیم OPS_CHAT_ID (دریافت lead ها)

```bash
# برای دریافت پیام‌های /lead در یک چت مدیریتی
npx wrangler secret put OPS_CHAT_ID
# وارد کنید: chat_id عددی شما (مثلاً: 123456789)
```

### تنظیم Cron برای بررسی خودکار هشدارها

در `wrangler.toml`:
```toml
[triggers]
crons = ["*/10 * * * *"]  # هر 10 دقیقه
```

---

## 🧪 تست و Debug

### تست محلی

```bash
cd /home/dev13/my-project/sites/secondary/novax-price-alert/deploy/cloudflare-worker

# اجرای worker به صورت محلی
npx wrangler dev

# در terminal دیگری، تست کنید:
curl http://localhost:8787/health
```

### بررسی Logs

```bash
# دیدن logs زنده
npx wrangler tail

# در تلگرام دستوری ارسال کنید و logs را ببینید
```

### بررسی وضعیت Webhook

```bash
curl https://novax-telegram-relay.<your-subdomain>.workers.dev/webhook-info
```

---

## 🛠️ عیب‌یابی (Troubleshooting)

### بات پاسخ نمی‌دهد

**چک‌لیست:**
1. Worker deploy شده است؟ `npx wrangler deployments list`
2. Secrets تنظیم شده‌اند؟ `npx wrangler secret list`
3. Webhook متصل است؟ `curl <WORKER_URL>/webhook-info`
4. Bot token معتبر است؟ در @BotFather چک کنید

**راه حل:**
```bash
# Reset webhook
curl https://novax-telegram-relay.<your-subdomain>.workers.dev/setup-bot

# بررسی logs
npx wrangler tail
```

### قیمت‌ها به‌روز نیستند

**علل احتمالی:**
- TGJU در دسترس نیست (فیلترینگ یا down)
- Cache TTL خیلی بالاست

**راه حل:**
```bash
# تست دستی fetch قیمت
curl "https://www.tgju.org/profile/price_dollar_rl"

# اگر دسترسی ندارید، از proxy استفاده کنید
```

### هشدارها trigger نمی‌شوند

**چک‌لیست:**
1. KV namespace تنظیم شده است؟
2. Cron trigger فعال است؟
3. Alert به درستی ساخته شده است؟

**راه حل:**
```bash
# بررسی KV data
npx wrangler kv:key list --namespace-id=<YOUR_KV_ID>
```

---

## 📊 محدودیت‌ها و توجهات

### محدودیت‌های Cloudflare Workers (Free Plan)

- ✅ 100,000 requests/day
- ✅ 10ms CPU time per request
- ✅ 128MB memory
- ⚠️ 50ms startup time (cold start)

**برای بات تلگرام معمولاً کافی است.**

### محدودیت‌های KV Storage (Free Plan)

- ✅ 100,000 read/day
- ✅ 1,000 write/day
- ✅ 1GB storage
- ⚠️ Eventually consistent

**برای تعداد کم کاربر کافی است.**

### دسترسی از ایران

- ✅ Cloudflare Workers از ایران قابل دسترسی است
- ✅ Telegram API قابل دسترسی است
- ⚠️ TGJU ممکن است فیلتر شود (از proxy استفاده کنید)

---

## 💰 هزینه‌ها

### رایگان (Free Tier)
- تا 100k request/day
- تا 1k KV write/day
- مناسب برای: تا 500 کاربر فعال

### پرداختی (Workers Paid - $5/month)
- 10M request/month
- بدون محدودیت KV
- مناسب برای: تا 10,000 کاربر فعال

**توصیه**: با free tier شروع کنید.

---

## 🔐 امنیت

### توصیه‌های امنیتی

1. **Secrets را محافظت کنید**
   - Bot Token را هرگز commit نکنید
   - از `wrangler secret` استفاده کنید

2. **RELAY_SECRET تنظیم کنید**
   - برای محافظت از endpoint های داخلی

3. **Rate Limiting**
   - Cloudflare به صورت خودکار rate limit دارد

4. **Input Validation**
   - Worker ورودی‌ها را validate می‌کند

---

## 📚 منابع مفید

### مستندات
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### فایل‌های پروژه
- `deploy/cloudflare-worker/telegram-relay.js` - کد اصلی worker
- `deploy/cloudflare-worker/wrangler.toml` - تنظیمات worker
- `deploy/cloudflare-worker/README.md` - مستندات worker

---

*راهنمای Telegram-Only بدون VPS - نواکس*
*آخرین بروزرسانی: 2026-06-14*
