# وضعیت پیشرفت

این سند باید با کد واقعی و گزارش‌های بهبود هم‌راستا بماند.

## وضعیت فعلی

- محصول یک بات تلگرام برای قیمت و هشدار قیمت است و relay آن روی Cloudflare اجرا می‌شود.
- منوی اصلی بات menu-driven است و چهار مسیر اصلی دارد: قیمت‌ها، تنظیم هشدار، هشدارهای من، راهنما.
- قیمت‌های زنده:
  - کریپتو از Binance با واحد `USDT`
  - ارز و طلا از TGJU با واحد `تومان`
- ساخت هشدار مرحله‌ای است و تا تایید نهایی فعال نمی‌شود.
- cron هر 10 دقیقه هشدارها را بررسی می‌کند.

## چیزهایی که در کد تثبیت شده‌اند

- canonical asset identity برای alertها
- snapshot شدن `display_asset_name_at_creation` و `target_price_display_unit`
- lifecycle state و confirmation gating برای activation
- مسیر حذف و لیست هشدارها
- retry/backoff برای fetch/send در مسیرهای موقت
- observability برای eventهای کلیدی هشدار و cron

## چیزهایی که از گزارش‌های بهبود باید مبنا بمانند

- دارایی و شرط باید همیشه explicit باشند.
- unit اصلی کاربر باید `تومان` باشد.
- summary نهایی باید قابل فهم و قابل بازبینی باشد.
- stale data نباید trigger بسازد.
- duplicate notification باید incident تلقی شود.

## کارهای باقی‌مانده

- metrics و مانیتورینگ دقیق‌تر
- تاریخچه‌ی قیمت
- گسترش کنترل‌شده‌ی دارایی‌ها و بازارها
- بهبودهای UX روی summary، edit، و delete flow

## مرجع‌ها

- [Architecture](ARCHITECTURE.md)
- [API](API.md)
- [Deployment](DEPLOYMENT.md)
- [Operations](OPERATIONS.md)
- [Observability](OBSERVABILITY.md)
- [User Guide](USER_GUIDE_FA.md)
