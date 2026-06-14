# Novax Price Alert

**🟢 Live**: https://novax.alirezasafeidev.ir
**🤖 Bot**: @novax_price_bot (ID: 8858674032)
**📊 Status**: Production Ready

---

## 🚀 Quick Start

### Option 1: Telegram-Only (Serverless - بدون VPS) ⭐ توصیه می‌شود

برای اجرای بات تلگرام به صورت کاملاً serverless با Cloudflare Workers:

```bash
# مستندات کامل
📖 راهنما: docs/TELEGRAM_ONLY_WITHOUT_VPS.md
✅ چک‌لیست: docs/TELEGRAM_BOT_EXECUTION_CHECKLIST.md
📊 تحلیل: docs/PROJECT_DECISION_ANALYSIS.md
```

**مزایا:**
- ✅ بدون نیاز به VPS
- ✅ هزینه صفر (Free Tier Cloudflare)
- ✅ مقیاس‌پذیری خودکار
- ✅ آماده در 30 دقیقه

**مراحل سریع:**
```bash
cd deploy/cloudflare-worker
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler deploy
curl "https://<your-worker>.workers.dev/setup-bot"
```

### Option 2: VPS Deployment (فعلی)

برای اجرای کامل با backend، database و mini-app:

```bash
# بررسی وضعیت production
curl https://novax.alirezasafeidev.ir/health
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest

# Sync و deploy
bash scripts/ONE-COMMAND-SYNC.sh
```

**VPS**: <redacted-vps-host> (ubuntu)
**Services**: systemd (novax-price-alert-api, novax-price-alert-worker, novax-mini-app)

---

## 📚 مستندات جدید (2026-06-14)

### 🎯 اجرای Telegram-Only

| سند | شرح | استفاده |
|-----|-----|----------|
| **[TELEGRAM_ONLY_WITHOUT_VPS.md](docs/TELEGRAM_ONLY_WITHOUT_VPS.md)** | راهنمای کامل اجرای serverless | برای راه‌اندازی اولیه |
| **[TELEGRAM_BOT_EXECUTION_CHECKLIST.md](docs/TELEGRAM_BOT_EXECUTION_CHECKLIST.md)** | چک‌لیست گام به گام (10 بخش) | برای دنبال کردن مراحل |
| **[PROJECT_DECISION_ANALYSIS.md](docs/PROJECT_DECISION_ANALYSIS.md)** | تحلیل تصمیم‌گیری و مقایسه | برای فهم دلایل انتخاب |

### 📖 مستندات عملیاتی

| سند | شرح |
|-----|-----|
| [START_HERE.md](START_HERE.md) | نقطه شروع کلی پروژه |
| [TELEGRAM_FIRST_RUNBOOK.md](docs/TELEGRAM_FIRST_RUNBOOK.md) | راهنمای عملیاتی Telegram-First |
| [COMPLETE_DEPLOYMENT_GUIDE.md](COMPLETE_DEPLOYMENT_GUIDE.md) | راهنمای deployment کامل |
| [SERVER_STATUS.md](docs/SERVER_STATUS.md) | وضعیت واقعی سرور production |

### 🏗️ مستندات فنی

| سند | شرح |
|-----|-----|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری سیستم |
| [API.md](docs/API.md) | مستندات API |
| [DEPLOYMENT_ARCHITECTURE.md](docs/DEPLOYMENT_ARCHITECTURE.md) | معماری deployment |

### 💼 مستندات تجاری

| سند | شرح |
|-----|-----|
| [PREMIUM_FEATURES_PLAN.md](docs/PREMIUM_FEATURES_PLAN.md) | برنامه ویژگی‌های پریمیوم |
| [USER_GUIDE_FA.md](docs/USER_GUIDE_FA.md) | راهنمای کاربر فارسی |

---

## 🤖 دستورات بات

### دستورات اصلی
- `/start` - شروع و معرفی بات
- `/help` - راهنمای استفاده
- `/prices` - نمایش قیمت‌های لحظه‌ای

### مدیریت هشدار
```bash
# ایجاد هشدار
/alert USD 170000 above    # دلار بالای 170,000 تومان
/alert USDT 175000 below   # تتر زیر 175,000 تومان
/alert GOLD 18000000 above # طلا بالای 18 میلیون تومان

# مشاهده هشدارها
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

## 🏗️ معماری

### Telegram-Only Mode (Serverless)

```
User → Telegram → Cloudflare Worker
                       ↓
                  TGJU API (قیمت‌ها)
                       ↓
                  KV Storage (هشدارها)
```

**ویژگی‌ها:**
- Serverless execution
- Global edge deployment
- Auto-scaling
- Free tier: 100k requests/day

### Full Stack Mode (VPS)

```
User → Telegram → Cloudflare Worker → Backend API
                                         ↓
                                    PostgreSQL
                                         ↓
                                    Worker Process
```

**ویژگی‌ها:**
- Complete feature set
- Mini-app (React)
- Advanced analytics
- Premium features

---

## 🔧 Development

### Install Dependencies
```bash
uv sync
```

### Run Tests
```bash
uv run pytest
```

### Run Linting
```bash
uv run ruff check .
```

### Type Checking
```bash
uv run mypy src
```

---

## 🌐 Production (VPS)

### Server Details
- **VPS**: <redacted-vps-host> (ubuntu)
- **Path**: `/home/ubuntu/novax-price-alert`
- **Domain**: novax.alirezasafeidev.ir
- **SSL**: Let's Encrypt

### Services (systemd)
```bash
# وضعیت
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app

# Restart
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker

# Logs
sudo journalctl -u novax-price-alert-api -f
sudo journalctl -u novax-price-alert-worker -f
```

---

## 📊 قیمت‌های فعلی (از TGJU)

قیمت‌ها هر 5 دقیقه به‌روز می‌شوند:

- **دلار آزاد**: ~1,720,000 تومان
- **یورو**: ~1,990,000 تومان
- **طلای 18 عیار**: ~172,000,000 تومان
- **سکه امامی**: ~1,734,000,000 تومان
- **تتر**: ~1,684,000 تومان

*قیمت‌ها از TGJU.org دریافت می‌شوند*

---

## 🎯 Use Cases

### برای کاربران
- دریافت هشدار قیمت برای خرید/فروش
- پیگیری قیمت دلار، طلا، سکه، تتر
- مقایسه قیمت‌های بازار

### برای توسعه‌دهندگان
- الگوی Telegram Bot با Cloudflare Workers
- معماری serverless برای بات‌های ایرانی
- Integration با TGJU API

---

## 🛠️ Technology Stack

### Telegram-Only
- **Runtime**: Cloudflare Workers
- **Language**: JavaScript
- **Storage**: KV Storage
- **API**: Telegram Bot API, TGJU

### Full Stack
- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: PostgreSQL, Redis
- **Frontend**: React, Vite
- **Deployment**: systemd, Nginx
- **Package Manager**: uv

---

## 💰 Monetization (Planned)

طبق `PREMIUM_FEATURES_PLAN.md`:
- **Free Tier**: تا 5 هشدار فعال
- **Premium**: هشدار نامحدود، analytics، API access
- **Target**: $5-10/month subscription

---

## 🤝 Contributing

این پروژه بخشی از workspace `my-project` است.

**Development Guidelines:**
- Python: 4-space indentation, ruff, mypy
- JavaScript: 2-space indentation, prettier
- Commits: Conventional Commits (feat, fix, chore)

---

## 📄 License

Proprietary - All rights reserved

---

## 👤 Author

**Alireza Safaei**
- Website: https://alirezasafaeisystems.ir
- Projects: https://audit.alirezasafaeisystems.ir

---

## 🔗 Quick Links

### 🚀 Getting Started
- [شروع سریع Telegram-Only](docs/TELEGRAM_ONLY_WITHOUT_VPS.md)
- [چک‌لیست اجرا](docs/TELEGRAM_BOT_EXECUTION_CHECKLIST.md)
- [تحلیل پروژه](docs/PROJECT_DECISION_ANALYSIS.md)

### 📖 Documentation
- [Index کامل مستندات](docs/README.md)
- [راهنمای deployment](COMPLETE_DEPLOYMENT_GUIDE.md)
- [وضعیت سرور](docs/SERVER_STATUS.md)

### 🔧 Development
- [Cloudflare Worker Code](deploy/cloudflare-worker/telegram-relay.js)
- [Backend API](src/novax_price_alert/)
- [Tests](tests/)

---

**Novax Price Alert** - بات هشدار قیمت برای بازار ایران 🇮🇷

*آخرین بروزرسانی: 2026-06-14*
