# معماری دیپلوی Novax Price Alert

**تاریخ**: 2026-06-12
**Bot ID**: 8858674032
**Username**: @novax_price_bot

---

## 🏗️ معماری فعلی

### سیستم اصلی: VPS (<redacted-vps-host>)

**محتوا**:
- ✅ Python/FastAPI Backend (پورت 8001)
- ✅ PostgreSQL Database
- ✅ Redis Cache/Queue
- ✅ Worker (Price Fetch + Alert Evaluation)
- ✅ TWA (Telegram Web App - React)
- ✅ Nginx (Reverse Proxy)
- ✅ PM2 (Process Manager)
- ✅ SSL (Let's Encrypt برای novax.alirezasafeidev.ir)

**ارتباطات**:
- Direct Telegram API (از VPS)
- Binance API (قیمت کریپتو)
- TGJU Scraping (قیمت فیات/طلا از ایران)
- Neon PostgreSQL (اگر از external DB استفاده شود)

---

### سیستم relay: Cloudflare Worker

**محتوا**:
- ✅ Telegram Webhook Handler
- ✅ Telegram API Relay (برای محدودیت IP ایران)
- ✅ KV Storage ( Alerts - در حالت پیش‌فرض خاموش)
- ✅ Analytics Metrics
- ✅ Cron Triggers (*/10 دقیقه)

**ارتباطات**:
- Telegram Webhook → Cloudflare Worker
- Cloudflare Worker → VPS API (اگر relay فعال باشد)
- یا مستقیم Telegram API → VPS (اگر relay غیرفعال باشد)

**URL**: `https://novax-telegram-relay.asdevelooper.workers.dev`

---

## 📊 حالت فعلی بر اساس PROGRESS.md

### سیستم VPS (Active):
```
novax.alirezasafeidev.ir → Nginx → FastAPI (8001) → Database
```

- API: https://novax.alirezasafeidev.ir/api/v1
- Health: https://novax.alirezasafeidev.ir/health
- TWA: https://novax.alirezasafeidev.ir/
- Worker: PM2 process `novax-worker` (cron job هر 10 دقیقه)
- API: PM2 process `novax-api`
- Mini-App: PM2 process `novax-mini-app`

### سیستم Cloudflare Worker (اختیاری - Relay):
```
Telegram → Webhook → Cloudflare Worker → (relay) → VPS
```

- Webhook: `/webhook` endpoint
- Health: `/health` endpoint
- Cron: `*/10 * * * *` (در حالت KV storage)
- Relay: `/send` endpoint برای ارسال پیام

---

## 🔗 اتصالات سیستم

### مسیر 1: بدون Relay (حالت فعلی پیشنهادی)
```
User → Telegram Bot
         ↓
Telegram API → VPS (Direct)
         ↓
FastAPI + PostgreSQL + Redis
```

**مزایا**:
- ساده‌تر، کمتر latency
- وابستگی کمتر به Cloudflare
- کنترل کامل روی VPS

**معایب**:
- ممکن است محدودیت IP در ایران داشته باشد (ولی از VPS ایرانی حل شده)

---

### مسیر 2: با Cloudflare Relay
```
User → Telegram Bot
         ↓
Telegram Webhook → Cloudflare Worker
         ↓ (relay)
VPS API (FastAPI)
         ↓
PostgreSQL + Redis
```

**مزایا**:
- Bypass محدودیت‌های IP تلگرام
- Load balancing
- DDoS protection از Cloudflare

**معایب**:
- بیشتر complexity
- وابستگی به Cloudflare
- اضافی latency

---

## 🚀 استراتژی دیپلوی پیشنهادی

### گزینه 1: فقط VPS (ساده‌ترین و پیشنهادی)

**چه چیز باید دیپلوی شود**:
1. Python Backend (FastAPI)
2. PostgreSQL Database
3. Redis Cache
4. Worker Process (PM2)
5. Nginx Configuration
6. SSL Certificate
7. TWA (Mini-App)

**چه چیزی لازم نیست**:
- ❌ Cloudflare Worker (برای حالت VPS-only، relay غیرفعال می‌شود)

**تنظیمات .env**:
```bash
TELEGRAM_RELAY_URL=  # خالی بگذارید
TELEGRAM_RELAY_SECRET=
```

---

### گزینه 2: VPS + Cloudflare Worker (پیشرفته)

**چه چیز باید دیپلوی شود**:
1. Cloudflare Worker (Deploy)
2. VPS (همه چیز از گزینه 1)
3. تنظیم Webhook روی Worker
4. تنظیم relay connection

**تنظیمات .env**:
```bash
TELEGRAM_RELAY_URL=https://novax-telegram-relay.asdevelooper.workers.dev
TELEGRAM_RELAY_SECRET=d0dea42744f215de668c40bbe208317a398b75f19fffe45226405a06b5a82197
```

---

## 📋 فهرست کامل برای دیپلوی VPS

### 1. روی VPS (<redacted-vps-host>):
- [ ] Python 3.10+ نصب باشد
- [ ] PostgreSQL نصب و اجرا باشد
- [ ] Redis نصب و اجرا باشد
- [ ] PM2 نصب باشد
- [ ] Nginx نصب و اجرا باشد
- [ ] SSL Certificate برای novax.alirezasafeidev.ir
- [ ] دایرکتوری `/home/deploy/novax-price-alert` وجود دارد
- [ ] فایل `.env` با مقادیر صحیح تنظیم شده است

### 2. Python Backend:
- [ ] `requirements.txt` نصب شده
- [ ] Database migrations اجرا شده (`alembic upgrade head`)
- [ ] API process روی پورت 8001 اجرا می‌شود
- [ ] Worker process هر 10 دقیقه اجرا می‌شود
- [ ] Mini-App process اجرا می‌شود

### 3. Nginx:
- [ ] SSL برای novax.alirezasafeidev.ir
- [ ] Proxy to http://127.0.0.1:8001
- [ ] /health endpoint قابل دسترسی
- [ ] /api endpoints قابل دسترسی

### 4. Cloudflare Worker (اختیاری):
- [ ] Worker deploy شده باشد
- [ ] Webhook تنظیم شده باشد
- [ ] KV namespaces موجود باشد
- [ ] Secrets تنظیم شده باشند

---

## 🎯 پیشنهاد دیپلوی

### حالت پیشنهادی: VPS-Only (بدون Cloudflare Relay)

**چرا؟**
- VPS ایرانی است و محدودیت IP تلگرام در ایران دارد
- سیستم ساده‌تر، کمتر وابستگی
- هزینه کمتر (هزینه VPS است، Cloudflare Worker رایگان ولی complexity اضافی)
- کنترل کامل روی سیستم

**دیپلوی فقط VPS کافی است.**

---

## 📝 ساده‌سازی

برای دیپلوی ساده و سریع، فقط این‌ها را روی VPS انجام بدهید:

1. Sync فایل‌ها به VPS
2. Install dependencies
3. Database migrations
4. PM2 restart
5. Health check

Cloudflare Worker را فقط deploy کنید اگر:
- به relay نیاز دارید
- می‌خواهید از KV storage استفاده کنید
- می‌خواهید DDoS protection اضافه کنید

---

*معماری دیپلوی تولید شده در 2026-06-12*
*پروژه Novax Price Alert*