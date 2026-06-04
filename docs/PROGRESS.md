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

## وضعیت فازبندی

- [x] Phase 0: Baseline Freeze — active docs aligned, no direct archive dependencies
- [x] Phase 1: UX Clarity — alert creation and price/unit clarity
- [x] Phase 2: Reliability Hardening — duplicate prevention and stale-data protection
- [x] Phase 3: Observability and Operations — health checks and incident readiness
- [x] Phase 4: Controlled Expansion — safe improvements after stability (metrics summary, price history, EUR alignment, and TWA polish completed)

## چیزهایی که از گزارش‌های بهبود باید مبنا بمانند

- این سند و `docs/IMPLEMENTATION_ROADMAP_FA.md` اکنون مرجع اصلی جهت‌دهی را فراهم می‌کنند.
- Report 01: محصول باید برای کاربر ایرانی واقعی تعریف شود و اولویتش شفافیت، اطمینان و hardening باشد.
- Report 02: شناسایی و رفع ابهام در انتخاب دارایی، جریان هشدار، ارسال تکراری، داده قدیمی، و دید عملیاتی.
- Report 03: تبدیل تحلیل‌ها به راهکارهای عملی برای محصول، UX، تکنولوژی و عملیات.
- Reports 04–06: جزئیات تاکتیکی برای چرخه زندگی هشدار، gateهای freshness، idempotency در ارسال، و پایش عملیاتی.
- دارایی و شرط باید همیشه explicit باشند.
- unit اصلی کاربر باید `تومان` باشد.
- summary نهایی باید قابل فهم و قابل بازبینی باشد.
- stale data نباید trigger بسازد.
- duplicate notification باید incident تلقی شود.

## کارهای باقی‌مانده

- metrics و مانیتورینگ دقیق‌تر: endpoint سبک `/metrics` و داشبورد عملیاتی JSON در `/metrics/summary` اضافه شده؛ time-series پایدار فقط در صورت نیاز عملیاتی بعدی انجام شود.
- تاریخچه‌ی قیمت: endpoint خواندنی `/api/v1/prices/history` روی snapshotهای موجود اضافه شده و TWA اکنون تاریخچه ۱۰ snapshot اخیر هر دارایی را نمایش می‌دهد؛ نمودار پیشرفته هنوز nice-to-have است.
- گسترش کنترل‌شده‌ی دارایی‌ها و بازارها: دارایی مستندشده‌ی EUR در backend seed و provider mappings هم‌راستا شد؛ گسترش بازارهای جدید فقط با mapping/test جدا انجام شود.
- بهبودهای UX روی summary، edit، و delete flow: summary، نمایش واحد/نام دارایی، escaping خروجی API، create→confirm flow، حذف، و اصلاح قیمت هدف هشدار در TWA انجام شده؛ flowهای پیشرفته‌تر nice-to-have هستند.

## مرجع‌ها

- [Architecture](ARCHITECTURE.md)
- [API](API.md)
- [Deployment](DEPLOYMENT.md)
- [Operations](OPERATIONS.md)
- [Observability](OBSERVABILITY.md)
- [User Guide](USER_GUIDE_FA.md)
