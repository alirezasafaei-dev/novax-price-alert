# Novax Price Alert

**🟢 Live**: https://novax.alirezasafeidev.ir
**🤖 Bot**: @novax_price_bot (ID: 8858674032)
**📊 Status**: Production Ready

---

## 🚀 Quick Start

### 1. Check Live Status
```bash
curl https://novax.alirezasafeidev.ir/health
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest
```

### 2. Sync Latest Changes (Optional)
```bash
bash scripts/ONE-COMMAND-SYNC.sh
```

### 3. Setup BotFather (Required for First-Time Setup)
See `docs/BOTFATHER_SETUP.md` for complete guide.

### 4. Test Bot
In Telegram, search @novax_price_bot and send `/start`

---

## 📚 Documentation

- **COMPLETE_DEPLOYMENT_GUIDE.md** - Complete automated deployment guide for agents
- **DEPLOYMENT_CHECKLIST.md** - Deployment checklist with verification steps
- **docs/RECENT_CHANGES.md** - Latest changes and improvements
- **START_HERE.md** - Quick start guide (BEGIN HERE)
- **docs/README.md** - Documentation index
- **docs/FINAL_STATUS_REPORT.md** - Complete status report
- **docs/SERVER_STATUS.md** - Real server configuration
- **docs/BOTFATHER_SETUP.md** - Telegram bot setup
- **docs/DEPLOYMENT_GUIDE.md** - Deployment instructions
- **docs/DEPLOYMENT_ARCHITECTURE.md** - Architecture documentation
- **docs/PREMIUM_FEATURES_PLAN.md** - Monetization strategy

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

---

## 🌐 Production

**VPS**: 193.93.169.58 (ubuntu)
**Path**: /home/ubuntu/novax-price-alert
**Services**: systemd (novax-price-alert-api, novax-price-alert-worker, novax-mini-app)

### Management
```bash
# SSH to VPS
ssh ubuntu@193.93.169.58

# Check services
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app

# Restart services
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app

# View logs
sudo journalctl -u novax-price-alert-api -f
sudo journalctl -u novax-price-alert-worker -f
```

---

## 🤖 Telegram Bot

**Bot**: @novax_price_bot
**Features**:
- Live price alerts (crypto + fiat/gold)
- Staged alert creation with confirmation
- Rich TWA with charts and analytics
- 10-minute price refresh

---

## 📊 Current Prices (Live)

- USD_IRT: 1,801,800 تومان
- EUR_IRT: 2,078,100 تومان
- GOLD_18K_IRT: 178,669,000 تومان
- SEKKEH_EMAMI_IRT: 1,820,100,000 تومان
- USDT_IRT: 1,757,010 تومان
- BTC/ETH/BNB: Currently mock data

---

*Novax Price Alert - Production Live*

[![CI](https://github.com/novax/novax-price-alert/actions/workflows/ci.yml/badge.svg)](https://github.com/novax/novax-price-alert/actions/workflows/ci.yml)

یک بات تلگرام برای نمایش قیمت و ثبت هشدار قیمت، با معماری سبک و قابل‌استقرار روی VPS.

## وضعیت کوتاه

- بات و relay در production کار می‌کنند.
- قیمت‌ها:
  - کریپتو از Binance با `USDT`
  - ارز و طلا از TGJU با `تومان`
- هشدارها مرحله‌ای ساخته می‌شوند و فقط بعد از تایید فعال می‌شوند.
- Cron هر 10 دقیقه هشدارها را بررسی می‌کند.

## راهنمای شروع سریع برای کاربران

### نحوهٔ آغاز کار با بات

1. در تلگرام به آدرس `@NovaxPriceAlert` پیام دهید.
2. دستور `/start` را بزنید تا منوی اصلی نمایش داده شود.
3. برای دیدن قیمت لحظه‌ای، دستور `/price` را بزنید و نام دارایی را انتخاب کنید
   (مثلاً `دلار`، `طلا`، `بیت‌کوین`).
4. برای ثبت هشدار، دستور `/alert` را بزنید و مراحل را دنبال کنید:
   - **انتخاب دارایی**: از لیست ارز، طلا یا کریپتو انتخاب کنید.
   - **نمایش قیمت**: قیمت لحظه‌ای نمایش داده می‌شود.
   - **وارد کردن هدف**: قیمت مورد نظر خود را وارد کنید.
   - **تأیید هشدار**: هشدار شما پس از تأیید فعال می‌شود.

### سیاست نمایش قیمت

- قیمت‌های بازار ایران (ارز، طلا) به **تومان** نمایش داده می‌شوند.
- قیمت‌های کریپتو به **USDT** نمایش داده می‌شوند.
- قیمت‌ها هر ۵ دقیقه به‌روز می‌شوند. اگر منقطع شوند، پیام «داده کهنه» نمایش داده می‌شود.

### جریان تأیید صریح هشدار

هر هشدار **فقط پس از تأیید صریح شما** فعال می‌شود:

1. هشدار در وضعیت «در انتظار تأیید» قرار می‌گیرد.
2. شما باید با دستور `/confirm` یا دکمه «تأیید»، هشدار را فعال کنید.
3. پس از تأیید، هشدار «فعال» شده و در صورت رسیدن قیمت به هدف، اعلان دریافت می‌کنید.
4. تا زمانی که تأیید نکنید، هشدار فعال نیست و اعلانی ارسال نمی‌شود.

### محدودیت‌ها

- هر کاربر می‌تواند حداکثر **۵ هشدار فعال** داشته باشد.
- پس از تریگر شدن، هشدار به صورت خودکار غیرفعال می‌شود (مگر آنکه دوباراً فعال کنید).

## شروع سریع (توسعه‌دهندگان)

- برای راه‌اندازی: [docs/QUICK_START_FA.md](docs/QUICK_START_FA.md)
- برای راهنمای کاربر: [docs/USER_GUIDE_FA.md](docs/USER_GUIDE_FA.md)
- برای جزئیات فنی: [docs/README.md](docs/README.md)
- مستندات قدیمی و retired drafts در خارج از مسیر مستندات فعال نگهداری می‌شوند.
- برای مسیر سریع ایجنت و چت جدید: [AGENTS.md](AGENTS.md) و [INDEX.md](INDEX.md)

## مستندات اصلی

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Deployment (VPS)](docs/DEPLOYMENT.md)
- [Deployment (Cloudflare + Render)](docs/CLOUDFLARE_RENDER_DEPLOYMENT.md) ⭐️ پیشنهادی
- [Operations](docs/OPERATIONS.md)
- [Observability](docs/OBSERVABILITY.md)
- [Progress](docs/PROGRESS.md)

## پنل ادمین (برای مالک)
پنل مدیریت حرفه‌ای و امن در مسیر `/admin` در دسترس است.

- دسترسی: `https://novax.alirezasafaeisystems.ir/admin?token=YOUR_ADMIN_ACCESS_TOKEN`
- قابلیت‌ها: نمای کلی سیستم، لیست همه هشدارها (با فیلتر و جستجو)، لیست کاربران، لغو دستی هشدار، لاگ اقدامات ادمین (audit)، عملیات سریع.
- توکن را در `.env` با کلید `ADMIN_ACCESS_TOKEN` ست کنید (رشته قوی و طولانی). سپس `pm2 restart novax-api --update-env`.

این پنل فقط برای مالک سیستم طراحی شده و از همان الگوی امنیتی metrics استفاده می‌کند.

## داشبورد هوشمند (مینی‌اپ تعاملی جدید)
یک پروتوتایپ پیشرفته و زیبا (React + Gemini سرور‌ساید) در پوشه `mini-app/` موجود است.

- داشبورد قیمت با چارت‌های SVG زنده + **محیط آزمایشی اسلایدر دستی** برای تست فوری هشدارها.
- شبیه‌ساز اعلان تلگرام (پاپ‌آپ + صدای واقعی).
- دستیار AI جمینای با آگاهی از قیمت‌های لحظه‌ای.
- **حالت Live**: با زدن دکمه "LIVE"، قیمت‌ها از بک‌اند واقعی خوانده می‌شوند و اسلایدر قیمت را در LatestPrice واقعی تزریق می‌کند (برای تست واقعی تریگرها).

اجرا:
```bash
cd mini-app
npm install
npm run dev   # http://localhost:3012
```

برای اتصال به بک‌اند محلی (روی پورت پیش‌فرض ۸۰۰۱):
- در mini-app/.env (کپی از .env.example) مقدار `VITE_NOVAX_API_BASE=http://localhost:8001` را ست کنید.
- بک‌اند اصلی را اجرا کنید (`python -m src.novax_price_alert` یا PM2).
- در داشبورد هوشمند دکمه SIM/LIVE را بزنید.

این ابزار برای تست، دمو و validation UX قبل از ویژگی‌های پریمیوم بسیار مفید است و مستقیماً چند آیتم از roadmap فاز ۱ (نوتیفیکیشن غنی + تست) را پوشش می‌دهد.

## وضعیت مستندات

- مستندات فعال باید کوتاه، همسو با کد، و قابل پیگیری باشند.
- drafts تاریخی جدا از مسیر مستندات فعال نگهداری می‌شوند.

### فایل‌های فعال (مستندات زنده)

| فایل | توضیح |
|------|-------|
| `README.md` | نقطه ورود اصلی (همین فایل) |
| `AGENTS.md` | راهنمای ایجنت برای هر نشست جدید |
| `INDEX.md` | فهرست فایل‌های کلیدی پروژه |
| `docs/README.md` | فهرست مستندات فعال |
| `docs/PROGRESS.md` | وضعیت پیاده‌سازی فعلی |
| `docs/API.md` | مستندات API |
| `docs/ARCHITECTURE.md` | معماری سیستم |
| `docs/OPERATIONS.md` | عملیات و نگهداری |
| `docs/OBSERVABILITY.md` | مشاهده‌پذیری |
| `docs/DEPLOYMENT.md` | راه‌اندازی VPS |
| `docs/CLOUDFLARE_RENDER_DEPLOYMENT.md` | راه‌اندازی Cloudflare + Render |
| `docs/QUICK_START_FA.md` | شروع سریع (فارسی) |
| `docs/USER_GUIDE_FA.md` | راهنمای کاربر (فارسی) |
| `docs/adr/` | تصمیمات معماری دائمی |

### فایل‌های آرشیو (غیرفعال)

برچسب: **آرشیو** — این فایل‌ها فقط برای مرجع تاریخی نگهداری می‌شوند و راهنمای عملیاتی فعلی نیستند.

مسیر: `docs/archive/`

- `docs/archive/ALERT_FLOW_CONTRACT.md` — قرارداد جریان هشدار (قدیمی)
- `docs/archive/ALERT_HARDENING_CONTRACTS.md` — قراردادهای سخت‌سازی هشدار
- `docs/archive/ALERT_LIFECYCLE_CONTRACT.md` — قرارداد چرخه عمر هشدار
- `docs/archive/ASSET_IDENTITY_POLICY.md` — سیاست هویت دارایی
- `docs/archive/BOT_BEHAVIOR.md` — رفتار بات (قدیمی)
- `docs/archive/DOMAIN_MODEL.md` — مدل دامنه (قدیمی)
- `docs/archive/FINAL_TEST_CHECKLIST_FA.md` — چک‌لیست تست نهایی
- `docs/archive/FRESHNESS_POLICY.md` — سیاست تازگی قیمت
- `docs/archive/HARDENING_IMPLEMENTATION_GUIDE.md` — راهنمای پیاده‌سازی سخت‌سازی
- `docs/archive/JOBS_AND_WORKERS.md` — کارها و ورکرها (قدیمی)
- `docs/archive/NEXT_STEPS_AND_ROADMAP_FA.md` — نقشه راه (قدیمی)
- `docs/archive/PRICING_PRESENTATION_POLICY.md` — سیاست نمایش قیمت
- `docs/archive/PRODUCTION_CHECKLIST_FA.md` — چک‌لیست تولید
- `docs/archive/PRODUCT_SCOPE.md` — محدوده محصول
- `docs/archive/PROVIDERS.md` — ارائه‌دهندگان (قدیمی)
- `docs/archive/RELEASE_READINESS_FA.md` — آمادگی انتشار
- `docs/archive/REUSE_PLAN.md` — برنامه استفاده مجدد
- `docs/archive/ROADMAP.md` — نقشه راه (قدیمی)
- `docs/archive/TELEGRAM_RUNBOOK.md` — دفترچه راهنمای تلگرام
- `docs/archive/USER_GUIDE_COMPLETE_FA.md` — راهنمای کاربر کامل (قدیمی)
- `docs/archive/root/` — فایل‌های وضعیت قدیمی ریشه

اگر موضوعی دوباره فعال شد، یک سند کوتاه زنده جدید بسازید و از `docs/README.md` به آن لینک دهید.
