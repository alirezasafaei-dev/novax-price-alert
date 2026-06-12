# وضعیت واقعی سرور Novax Price Alert

**تاریخ**: 2026-06-12
**آخرین دیپلوی**: تکمیل شده ✅
**VPS**: <redacted-vps-host>
**Domain**: novax.alirezasafeidev.ir
**Bot ID**: 8858674032 (@novax_price_bot)

---

## 🏗️ معماری واقعی سرور

### سیستم اصلی: VPS (<redacted-vps-host>)

**مسیر واقعی**: `/home/ubuntu/novax-price-alert`

**مدیریت سرویس**: systemd (نه PM2)

**سرویس‌های systemd**:
- `novax-price-alert-api` - FastAPI Backend
- `novax-price-alert-worker` - Worker (Price Fetch + Alert Evaluation)
- `novax-mini-app` - TWA (Telegram Web App)

**محتوا**:
- ✅ Python/FastAPI Backend (پورت 8001)
- ✅ PostgreSQL Database
- ✅ Redis Cache/Queue
- ✅ Worker Process (هر 10 دقیقه)
- ✅ TWA (Telegram Web App - React)
- ✅ Nginx (Reverse Proxy)
- ✅ SSL (Let's Encrypt برای novax.alirezasafeidev.ir)

**ارتباطات**:
- Direct Telegram API (از VPS)
- Binance API (قیمت کریپتو - فعلاً mock)
- TGJU Scraping (قیمت فیات/طلا از Iran)
- PostgreSQL (local)

---

## 📊 وضعیت دیپلوی

### ✅ انجام شده:
1. ✅ SSH connection verified (key-based, no password needed)
2. ✅ rsync فایل‌ها به `/home/ubuntu/novax-price-alert`
3. ✅ uv sync — Python dependencies updated
4. ✅ npm run build با Node 20 — mini-app rebuilt
5. ✅ هیچ migration جدیدی نبود (همه قبلاً اجرا شده)
6. ✅ Restart سرویس‌های systemd
7. ✅ Health check: API 200, Prices OK, Domain SSL سالم, Mini-app 200

---

## 🔧 مدیریت سرویس‌ها (Systemd)

### دستورات systemd:

```bash
# وضعیت سرویس‌ها
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app

# Restart سرویس‌ها
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app

# Logs
sudo journalctl -u novax-price-alert-api -f
sudo journalctl -u novax-price-alert-worker -f
sudo journalctl -u novax-mini-app -f
```

---

## 🌐 Health Checks (تأیید شده)

### API Health:
```bash
curl https://novax.alirezasafeidev.ir/health
# Response: {"status":"ok","db":"connected"} ✅
```

### Prices API:
```bash
curl -k https://novax.alirezasafeidev.ir/api/v1/prices/latest
# Response: JSON با 8 دارایی ✅
```

### TWA:
```bash
curl -k https://novax.alirezasafeidev.ir/
# Response: HTML کامل ✅
```

### دارایی‌های فعال:
- USD_IRT (دلار) - 1,801,800 تومان
- EUR_IRT (یورو) - 2,078,100 تومان
- GOLD_18K_IRT (طلای 18 عیار) - 178,669,000 تومان
- SEKKEH_EMAMI_IRT (سکه امامی) - 1,820,100,000 تومان
- USDT_IRT (تتر) - 1,757,010 تومان
- BTC_USDT (بیت‌کوین) - 95.92 USDT (mock)
- ETH_USDT (اتریوم) - 102.42 USDT (mock)
- BNB_USDT (BNB) - 95.58 USDT (mock)

**نکته**: کریپتو فعلاً mock است ولی فیات/طلا از TGJU زنده است.

---

## 🤖 Bot Status

**Bot ID**: 8858674032
**Username**: @novax_price_bot
**Status**: لطفاً در تلگرام تست کنید:
1. پیدا کنید @novax_price_bot
2. ارسال `/start`
3. ارسال `/price`
4. تلاش برای ایجاد هشدار

---

## 🎯 دستورات مفید

### به VPS وصل شوید:
```bash
ssh ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert
```

### Check status:
```bash
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app
```

### View logs:
```bash
sudo journalctl -u novax-price-alert-api -n 50
sudo journalctl -u novax-price-alert-worker -n 50
sudo journalctl -u novax-mini-app -n 50
```

### Restart services:
```bash
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app
```

---

## ⚠️ تفاوت با مستندات قبلی

### مسیر:
- **قبلاً در مستندات**: `/home/deploy/novax-price-alert`
- **مسیر واقعی**: `/home/ubuntu/novax-price-alert`

### مدیریت سرویس:
- **قبلاً در مستندات**: PM2
- **واقعی**: systemd

### Python package manager:
- **قبلاً در مستندات**: pip
- **واقعی**: uv

---

## ✅ وضعیت نهایی

**دیپلوی موفق و کامل است.**
- ✅ همه سرویس‌ها فعال
- ✅ Health checks پاس می‌دهند
- ✅ Prices API کار می‌کند
- ✅ TWA قابل دسترسی است
- ✅ SSL سالم است
- ✅ Database متصل است

**پروژه Novax Price Alert روی VPS <redacted-vps-host> در production است.**

---

*وضعیت واقعی سرور - 2026-06-12*
*دیپلوی کامل شده ✅*