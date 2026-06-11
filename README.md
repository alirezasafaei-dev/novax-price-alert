# Novax Price Alert

یک بات تلگرام برای نمایش قیمت و ثبت هشدار قیمت، با معماری سبک و قابل‌استقرار روی VPS.

## وضعیت کوتاه

- بات و relay در production کار می‌کنند.
- قیمت‌ها:
  - کریپتو از Binance با `USDT`
  - ارز و طلا از TGJU با `تومان`
- هشدارها مرحله‌ای ساخته می‌شوند و فقط بعد از تایید فعال می‌شوند.
- Cron هر 10 دقیقه هشدارها را بررسی می‌کند.

## شروع سریع

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

## Advanced Studio (مینی‌اپ تعاملی جدید)
یک پروتوتایپ پیشرفته و زیبا (React + Gemini سرور‌ساید) در پوشه `mini-app/` موجود است.

- داشبورد قیمت با چارت‌های SVG زنده + **پلی‌گراند اسلایدر دستی** برای تست فوری هشدارها.
- شبیه‌ساز نوتیفیکیشن تلگرام (پاپ‌آپ + صدای واقعی).
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
- در استودیو دکمه SIM/LIVE را بزنید.

این ابزار برای تست، دمو و validation UX قبل از ویژگی‌های پریمیوم بسیار مفید است و مستقیماً چند آیتم از roadmap فاز ۱ (نوتیفیکیشن غنی + تست) را پوشش می‌دهد.

## وضعیت مستندات

- مستندات فعال باید کوتاه، همسو با کد، و قابل پیگیری باشند.
- drafts تاریخی جدا از مسیر مستندات فعال نگهداری می‌شوند.
