# چک‌لیست اجرای بات تلگرام نواکس (بدون VPS)

**تاریخ**: 2026-06-14
**پروژه**: Novax Price Alert
**هدف**: راه‌اندازی بات تلگرام با Cloudflare Workers

---

## 📋 چک‌لیست پیش از شروع

### محیط کاری
- [ ] Node.js 18+ نصب شده است
- [ ] دسترسی به terminal دارید
- [ ] Git نصب شده است
- [ ] اتصال اینترنت پایدار دارید

### حساب‌ها و دسترسی‌ها
- [ ] حساب Cloudflare دارید (ثبت‌نام رایگان در cloudflare.com)
- [ ] حساب Telegram دارید
- [ ] دسترسی به @BotFather دارید

---

## 🤖 بخش 1: ایجاد و تنظیم بات تلگرام

### 1.1 ایجاد بات در BotFather

```
✓ مراحل:
1. در تلگرام @BotFather را پیدا کنید
2. دستور /newbot را ارسال کنید
3. نام بات را وارد کنید (مثال: Novax Price Alert)
4. username بات را وارد کنید (باید به _bot ختم شود، مثال: novax_price_bot)
5. Bot Token را یادداشت کنید (مثال: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)
```

**چک‌لیست:**
- [ ] بات ایجاد شد
- [ ] Bot Token دریافت شد
- [ ] Bot Token در جای امن ذخیره شد
- [ ] Username بات یادداشت شد

### 1.2 تنظیمات بات در BotFather

```bash
# تنظیم توضیحات بات
/setdescription
# انتخاب بات
# متن: "بات هشدار قیمت برای بازار ایران - دلار، یورو، طلا، سکه، تتر و کریپتو"

# تنظیم About
/setabouttext
# متن: "بات نواکس - هشدار قیمت لحظه‌ای بازار ایران"

# تنظیم عکس پروفایل (اختیاری)
/setuserpic
```

**چک‌لیست:**
- [ ] Description تنظیم شد
- [ ] About تنظیم شد
- [ ] عکس پروفایل آپلود شد (اختیاری)

---

## ☁️ بخش 2: تنظیم Cloudflare Workers

### 2.1 ایجاد حساب Cloudflare

```
✓ مراحل:
1. به cloudflare.com بروید
2. روی "Sign Up" کلیک کنید
3. ایمیل و پسورد وارد کنید
4. ایمیل را تایید کنید
5. وارد Dashboard شوید
```

**چک‌لیست:**
- [ ] حساب Cloudflare ایجاد شد
- [ ] ایمیل تایید شد
- [ ] وارد Dashboard شدید

### 2.2 نصب Wrangler CLI

```bash
# نصب Wrangler به صورت global
npm install -g wrangler

# بررسی نصب
wrangler --version

# لاگین به Cloudflare
wrangler login
# مرورگر باز می‌شود، Allow را بزنید
```

**چک‌لیست:**
- [ ] Wrangler نصب شد
- [ ] Version نمایش داده شد
- [ ] Login موفق بود
- [ ] پیام "Successfully logged in" نمایش داده شد

---

## 📦 بخش 3: آماده‌سازی پروژه

### 3.1 دریافت کد پروژه

```bash
# اگر پروژه را ندارید:
cd ~
git clone <repository-url>
cd my-project/sites/secondary/novax-price-alert

# اگر دارید:
cd /home/dev13/my-project/sites/secondary/novax-price-alert
git pull
```

**چک‌لیست:**
- [ ] کد پروژه دریافت شد
- [ ] در دایرکتوری پروژه هستید

### 3.2 نصب Dependencies

```bash
# رفتن به دایرکتوری worker
cd deploy/cloudflare-worker

# نصب dependencies
npm install

# بررسی نصب
ls -la node_modules/
```

**چک‌لیست:**
- [ ] npm install بدون خطا اجرا شد
- [ ] node_modules ایجاد شد
- [ ] package-lock.json به‌روز شد

### 3.3 بررسی فایل‌های پروژه

```bash
# بررسی فایل‌های مهم
ls -la telegram-relay.js
ls -la wrangler.toml
cat wrangler.toml
```

**چک‌لیست:**
- [ ] telegram-relay.js موجود است
- [ ] wrangler.toml موجود است
- [ ] محتوای wrangler.toml معتبر است

---

## 🔐 بخش 4: تنظیم Secrets

### 4.1 تنظیم Bot Token

```bash
# تنظیم TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN

# وقتی prompt آمد، Bot Token را paste کنید
# فرمت: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

**چک‌لیست:**
- [ ] دستور اجرا شد
- [ ] Bot Token وارد شد
- [ ] پیام "Success" نمایش داده شد

### 4.2 تنظیم Relay Secret (امنیت اضافه)

```bash
# تولید یک secret تصادفی
SECRET=$(openssl rand -hex 32)
echo $SECRET

# تنظیم RELAY_SECRET
npx wrangler secret put RELAY_SECRET
# secret تصادفی را paste کنید
```

**چک‌لیست:**
- [ ] Secret تولید شد
- [ ] RELAY_SECRET تنظیم شد
- [ ] Secret در جای امن ذخیره شد

### 4.3 بررسی Secrets

```bash
# لیست secrets تنظیم شده
npx wrangler secret list
```

**خروجی انتظاری:**
```
TELEGRAM_BOT_TOKEN
RELAY_SECRET
```

**چک‌لیست:**
- [ ] TELEGRAM_BOT_TOKEN در لیست است
- [ ] RELAY_SECRET در لیست است

---

## 🚀 بخش 5: Deploy Worker

### 5.1 Deploy به Cloudflare

```bash
# Deploy worker
npx wrangler deploy

# خروجی شبیه این خواهد بود:
# Total Upload: xx.xx KiB / gzip: xx.xx KiB
# Uploaded novax-telegram-relay (X.XX sec)
# Published novax-telegram-relay (X.XX sec)
#   https://novax-telegram-relay.<your-subdomain>.workers.dev
```

**چک‌لیست:**
- [ ] Deploy بدون خطا انجام شد
- [ ] URL worker نمایش داده شد
- [ ] URL worker یادداشت شد

### 5.2 بررسی Health Endpoint

```bash
# جایگزین کنید <WORKER_URL>
export WORKER_URL=https://novax-telegram-relay.<your-subdomain>.workers.dev

# تست health
curl "${WORKER_URL}/health"
```

**خروجی انتظاری:**
```json
{"status":"ok","service":"novax-telegram-relay"}
```

**چک‌لیست:**
- [ ] Health endpoint پاسخ می‌دهد
- [ ] status: "ok" است
- [ ] service نام صحیح دارد

---

## 🔗 بخش 6: اتصال Webhook تلگرام

### 6.1 تنظیم Webhook و Commands

```bash
# تنظیم webhook و commands یکجا
curl "${WORKER_URL}/setup-bot"
```

**خروجی انتظاری:**
```json
{
  "webhook": {
    "ok": true,
    "result": true,
    "description": "Webhook was set"
  },
  "commands": {
    "ok": true,
    "result": true
  }
}
```

**چک‌لیست:**
- [ ] webhook.ok === true
- [ ] commands.ok === true
- [ ] هیچ خطایی نمایش نداده شد

### 6.2 بررسی وضعیت Webhook

```bash
# بررسی webhook info
curl "${WORKER_URL}/webhook-info"
```

**خروجی انتظاری:**
```json
{
  "ok": true,
  "result": {
    "url": "https://novax-telegram-relay.<your-subdomain>.workers.dev/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

**چک‌لیست:**
- [ ] url صحیح است
- [ ] pending_update_count: 0 است
- [ ] خطایی وجود ندارد

---

## ✅ بخش 7: تست بات

### 7.1 تست دستورات اصلی

```
در تلگرام:
1. بات خود را پیدا کنید (@<your_bot_username>)
2. دکمه START را بزنید یا /start ارسال کنید
```

**انتظار:**
- پیام خوش‌آمدگویی نمایش داده شود
- توضیحات بات نمایش شود

**چک‌لیست:**
- [ ] بات پاسخ داد
- [ ] پیام خوش‌آمدگویی صحیح است
- [ ] هیچ خطایی نمایش نداده شد

### 7.2 تست دستور Help

```
/help
```

**انتظار:**
- لیست دستورات نمایش داده شود
- راهنمای استفاده نمایش شود

**چک‌لیست:**
- [ ] لیست دستورات کامل است
- [ ] متن فارسی صحیح است

### 7.3 تست دستور Prices

```
/prices
```

**انتظار:**
- قیمت‌های لحظه‌ای نمایش شود
- حداقل 4 دارایی (USD, USDT, GOLD, SEKKEH)
- قیمت‌ها به تومان

**چک‌لیست:**
- [ ] قیمت‌ها دریافت شدند
- [ ] قیمت دلار نمایش داده شد
- [ ] قیمت طلا نمایش داده شد
- [ ] قیمت تتر نمایش داده شد
- [ ] زمان به‌روزرسانی نمایش شد

### 7.4 تست ایجاد هشدار

```
/alert USD 170000 above
```

**انتظار:**
- تایید ایجاد هشدار
- جزئیات هشدار نمایش شود

**چک‌لیست:**
- [ ] هشدار ایجاد شد
- [ ] پیام تایید نمایش داده شد
- [ ] ID هشدار دریافت شد

### 7.5 تست لیست هشدارها

```
/alerts
```

**انتظار:**
- لیست هشدارهای فعال
- اگر هشدار نیست: "هیچ هشداری فعال نیست"

**چک‌لیست:**
- [ ] لیست هشدارها نمایش داده شد
- [ ] هشدار ساخته شده در لیست است

### 7.6 تست حذف هشدار

```
/delete <alert_id>
```

**انتظار:**
- پیام تایید حذف

**چک‌لیست:**
- [ ] هشدار حذف شد
- [ ] پیام تایید نمایش داده شد

---

## 🔧 بخش 8: تنظیمات پیشرفته (اختیاری)

### 8.1 فعال‌سازی KV Storage

```bash
# ایجاد KV namespace
npx wrangler kv:namespace create ALERTS_KV

# خروجی شبیه این:
# { binding = "ALERTS_KV", id = "xxxxxxxxxxxxxxxxxxxxxx" }
```

**ویرایش wrangler.toml:**
```toml
[[kv_namespaces]]
binding = "ALERTS_KV"
id = "xxxxxxxxxxxxxxxxxxxxxx"  # ID از خروجی قبلی
```

**Deploy مجدد:**
```bash
npx wrangler deploy
```

**چک‌لیست:**
- [ ] KV namespace ایجاد شد
- [ ] ID به wrangler.toml اضافه شد
- [ ] Deploy مجدد موفق بود

### 8.2 تنظیم OPS_CHAT_ID (دریافت Lead)

```bash
# دریافت Chat ID خود:
# 1. به @userinfobot پیام دهید
# 2. Chat ID را یادداشت کنید

# تنظیم OPS_CHAT_ID
npx wrangler secret put OPS_CHAT_ID
# Chat ID عددی را وارد کنید (مثال: 123456789)
```

**تست:**
```
در بات خود:
/lead سلام، علاقه‌مند به اطلاعات بیشتر هستم
```

**چک‌لیست:**
- [ ] Chat ID دریافت شد
- [ ] OPS_CHAT_ID تنظیم شد
- [ ] پیام lead در چت ops دریافت شد

### 8.3 فعال‌سازی Cron (بررسی خودکار هشدارها)

**ویرایش wrangler.toml:**
```toml
[triggers]
crons = ["*/10 * * * *"]  # هر 10 دقیقه
```

**Deploy مجدد:**
```bash
npx wrangler deploy
```

**چک‌لیست:**
- [ ] Cron به wrangler.toml اضافه شد
- [ ] Deploy موفق بود
- [ ] Cron در dashboard فعال است

---

## 📊 بخش 9: Monitoring و Logs

### 9.1 مشاهده Logs زنده

```bash
# Terminal جداگانه باز کنید
npx wrangler tail

# در تلگرام دستوری ارسال کنید و logs را ببینید
```

**چک‌لیست:**
- [ ] Logs نمایش داده می‌شوند
- [ ] Request ها log می‌شوند
- [ ] خطایی وجود ندارد

### 9.2 بررسی Cloudflare Dashboard

```
1. به dash.cloudflare.com بروید
2. Workers & Pages را انتخاب کنید
3. novax-telegram-relay را پیدا کنید
4. Analytics را ببینید
```

**چک‌لیست:**
- [ ] Worker در dashboard است
- [ ] Requests نمایش داده می‌شوند
- [ ] Error rate پایین است

---

## 🛠️ بخش 10: عیب‌یابی

### مشکل: بات پاسخ نمی‌دهد

```bash
# 1. بررسی webhook
curl "${WORKER_URL}/webhook-info"

# 2. بررسی secrets
npx wrangler secret list

# 3. بررسی logs
npx wrangler tail

# 4. Reset webhook
curl "${WORKER_URL}/setup-bot"

# 5. تست مجدد
# در تلگرام /start را ارسال کنید
```

**چک‌لیست:**
- [ ] Webhook متصل است
- [ ] Secrets موجودند
- [ ] خطایی در logs نیست
- [ ] بات پس از reset کار می‌کند

### مشکل: قیمت‌ها دریافت نمی‌شوند

```bash
# تست دسترسی به TGJU
curl "https://www.tgju.org/profile/price_dollar_rl"

# بررسی logs
npx wrangler tail

# تست endpoint prices
curl "${WORKER_URL}/prices"
```

**چک‌لیست:**
- [ ] TGJU در دسترس است
- [ ] خطای CORS یا network نیست
- [ ] Cache کار می‌کند

### مشکل: هشدارها trigger نمی‌شوند

```bash
# بررسی KV
npx wrangler kv:key list --namespace-id=<YOUR_KV_ID>

# بررسی Cron
# در wrangler.toml ببینید

# بررسی logs
npx wrangler tail
```

**چک‌لیست:**
- [ ] KV namespace موجود است
- [ ] Cron فعال است
- [ ] هشدارها در KV ذخیره می‌شوند

---

## ✅ چک‌لیست نهایی

### وضعیت عمومی
- [ ] حساب Cloudflare فعال است
- [ ] بات تلگرام ایجاد شده
- [ ] Bot Token دریافت شده
- [ ] Wrangler نصب و login شده

### Deploy
- [ ] Worker deploy شده
- [ ] Secrets تنظیم شدند
- [ ] Webhook متصل شده
- [ ] Health endpoint پاسخ می‌دهد

### عملکرد
- [ ] دستور /start کار می‌کند
- [ ] دستور /help کار می‌کند
- [ ] دستور /prices قیمت‌ها را نمایش می‌دهد
- [ ] دستور /alert هشدار ایجاد می‌کند
- [ ] دستور /alerts لیست را نمایش می‌دهد
- [ ] دستور /delete هشدار را حذف می‌کند

### تنظیمات پیشرفته (اختیاری)
- [ ] KV Storage فعال است
- [ ] OPS_CHAT_ID تنظیم شده
- [ ] Cron برای بررسی هشدارها فعال است

### مستندات
- [ ] URL worker یادداشت شد
- [ ] Bot username یادداشت شد
- [ ] Secrets در جای امن نگهداری می‌شوند

---

## 🎯 نتیجه

اگر تمام موارد چک‌لیست ✅ باشند، بات شما آماده استفاده است!

**بات شما اکنون:**
- ✅ 24/7 در دسترس است
- ✅ Serverless اجرا می‌شود
- ✅ مقیاس‌پذیر است
- ✅ رایگان (تا 100k request/day)
- ✅ از ایران قابل دسترسی است

**دستورات مفید:**
```bash
# بررسی وضعیت
curl "${WORKER_URL}/health"
curl "${WORKER_URL}/webhook-info"

# مشاهده logs
npx wrangler tail

# به‌روزرسانی worker
npx wrangler deploy

# مدیریت secrets
npx wrangler secret list
npx wrangler secret put <NAME>
npx wrangler secret delete <NAME>
```

---

**توجه**: این چک‌لیست را برای deployment بعدی نگه دارید!

*چک‌لیست اجرای بات تلگرام نواکس*
*آخرین بروزرسانی: 2026-06-14*
