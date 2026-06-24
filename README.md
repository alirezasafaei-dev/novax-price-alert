# Novax Price Alert

**🟢 Live**: https://novax-telegram-relay.asdevelooper.workers.dev
**🌐 Mini-App**: https://novax-telegram-relay.asdevelooper.workers.dev/mini-app/
**🤖 Bot**: @novax_price_bot
**📊 Status**: Production Ready

---

## 🚀 Quick Start

### Option 1: Cloudflare Worker + Mini-App (Serverless - بدون VPS) ⭐ فعلی

برای اجرای بات تلگرام و مینی‌اپ به صورت serverless با Cloudflare Workers + KV:

```bash
deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/health"
curl -fsS "https://novax-telegram-relay.asdevelooper.workers.dev/mini-app/"
```

**مزایا:**
- ✅ بدون نیاز به VPS ایرانی برای تجربه Telegram
- ✅ هزینه صفر (Free Tier Cloudflare)
- ✅ مقیاس‌پذیری خودکار
- ✅ Worker، webhook، cron و mini-app در یک مسیر خارجی

**مستندات:**
```bash
📖 راهنما: docs/CLOUDFLARE_PAGES_MINI_APP.md
📖 راهنمای Worker: deploy/cloudflare-worker/README.md
📊 وضعیت: docs/PROGRESS.md
```

### Option 2: Legacy VPS Deployment

برای مسیر قدیمی backend/database روی VPS:

```bash
# بررسی وضعیت legacy
curl https://novax.alirezasafeidev.ir/health
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest

# Sync و deploy
bash scripts/ONE-COMMAND-SYNC.sh
```

**VPS**: legacy; جزئیات اتصال نباید در git یا docs نوشته شود.
**Services**: systemd (novax-price-alert-api, novax-price-alert-worker, novax-mini-app)

---

## 📚 مستندات جدید

### 🎯 اجرای Telegram-Only

| سند | شرح | استفاده |
|-----|-----|----------|
| **[TELEGRAM_ONLY_WITHOUT_VPS.md](docs/TELEGRAM_ONLY_WITHOUT_VPS.md)** | راهنمای کامل اجرای serverless | برای راه‌اندازی اولیه |
| **[CLOUDFLARE_PAGES_MINI_APP.md](docs/CLOUDFLARE_PAGES_MINI_APP.md)** | مسیر فعلی Worker-hosted mini-app | برای دیپلوی مینی‌اپ خارجی |
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

## 🌐 Production (Cloudflare)

### Server Details
- **Worker**: `https://novax-telegram-relay.asdevelooper.workers.dev`
- **Mini-App**: `https://novax-telegram-relay.asdevelooper.workers.dev/mini-app/`
- **Storage**: Cloudflare KV (`ALERTS_KV`, `SESSIONS_KV`, `USERS_KV`)
- **Cron**: Cloudflare Worker schedule every 10 minutes

### Deploy
```bash
deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh
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
- [دیپلوی Worker-hosted Mini-App](docs/CLOUDFLARE_PAGES_MINI_APP.md)
- [شروع سریع Telegram-Only](docs/TELEGRAM_ONLY_WITHOUT_VPS.md)
- [چک‌لیست اجرا](docs/TELEGRAM_BOT_EXECUTION_CHECKLIST.md)
- [تحلیل پروژه](docs/PROJECT_DECISION_ANALYSIS.md)

### 📖 Documentation
- [Index کامل مستندات](docs/README.md)
- [راهنمای Worker](deploy/cloudflare-worker/README.md)
- [وضعیت پیشرفت](docs/PROGRESS.md)

### 🔧 Development
- [Cloudflare Worker Code](deploy/cloudflare-worker/src/index.js)
- [Backend API](src/novax_price_alert/)
- [Tests](tests/)

---

**Novax Price Alert** - بات هشدار قیمت برای بازار ایران 🇮🇷

*آخرین بروزرسانی: 2026-06-24*
