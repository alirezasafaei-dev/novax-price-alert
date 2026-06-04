# وضعیت پیشرفت

این سند باید با کد واقعی، گزارش‌های بهبود (`/home/dev13/Documents/my-doc/PROJECT_IMPROVEMENT_REPORT_FA/` 01-06) و `docs/IMPLEMENTATION_ROADMAP_FA.md` هم‌راستا بماند.

**مرجع اصلی فازبندی و تسک‌ها:** گزارش کامل بهبود پروژه (مسائل ۹گانه، راهکارهای اجرایی، ۵ فاز دقیق، taskهای T-xxx با اولویت P0/P1/P2 + owner + acceptance criteria، sprint plan، KPI، risk register).

## وضعیت فعلی محصول (Production)

- بات تلگرام menu-driven + Cloudflare Worker relay (webhook، کیبورد غنی، web_app button به TWA).
- قیمت زنده:
  - کریپتو: Binance (USDT)
  - فیات/طلا: TGJU (تومان) + fallback
- ساخت هشدار: مرحله‌ای (۶ گام استاندارد از گزارش: انتخاب دارایی → قیمت فعلی → شرط → قیمت هدف → خلاصه → تایید صریح)؛ فقط بعد از تایید فعال می‌شود (pending_confirmation → active).
- cron/worker هر ۱۰ دقیقه قیمت را refresh و alertها را evaluate می‌کند.
- TWA (مینی‌اپ تک‌فایل در `/`): تب‌دار کامل (💰 قیمت‌ها | 📁 دارایی‌های من | 🔔 هشدارها | 📈 چارت پیشرفته | ➕ ایجاد)، responsive Tailwind + Chart.js، SEO/meta کامل.
- My Assets: دارایی‌های کاربر را گروه‌بندی می‌کند + تعداد هشدار + آخرین قیمت + دکمه اقدام سریع.
- Suggestions: دارایی‌های unwatched را پیشنهاد می‌دهد + prefill wizard با یک ضربه.
- چارت پیشرفته: انتخاب چند دارایی + بازه‌های زمانی (1d/7d/30d/90d) + لاین‌های چندرنگ + تم دارک.
- ingest واقعی (POST /api/v1/prices/ingest با توکن) + GitHub Action (price-fetcher) که از runner خارجی قیمت‌ها را به canonical code می‌فرستد.
- DB: Postgres (جداگانه)، Alembic migrations کامل، Redis کش/صف، health + backup.
- دیپلوی: PM2 (novax-api روی 8001 + novax-worker)، nginx اختصاصی برای novax.alirezasafaeisystems.ir + SSL (certbot با novax در SAN)، .env-driven، healthcheck گسترش‌یافته.

## چیزهای تثبیت‌شده (هم‌راستا با گزارش)

- جریان هشدار با gating تایید صریح و snapshot نام/واحد در زمان ایجاد (explicit).
- برخی guards اولیه برای جلوگیری از trigger روی داده stale.
- retry/backoff در مسیرهای fetch/send.
- observability پایه برای eventهای کلیدی (evaluate، send، fetch) + endpointهای health/ingest/latest.
- canonical asset در بخش‌هایی از مدل (mapping provider → asset).
- TWA غنی و یکپارچه با بات (تب، My Assets، Suggestions، چارت، CTAها) — این‌ها بهبودهای production-grade برای UX و کارایی هستند (فراتر از MVP، مطابق درخواست "بهترین کار ممکن").

## وضعیت فازبندی (مطابق دقیق گزارش 04 + taskهای 05)

- [x] فاز صفر: تثبیت قراردادها و شفاف‌سازی مبنا (T-001 تا T-005) — سیاست‌ها در گزارش + این roadmap distill شده؛ پیاده‌سازی جزئی در کد (flow مرحله‌ای، snapshot، gating، freshness اولیه)؛ نیاز به مستند رسمی سیاست‌ها.
- [x] فاز یک: اصلاح UX و Alert Flow (T-101 تا T-104 اصلی + کارهای غنی) — flow مرحله‌ای + تایید استاندارد + متن‌های بهتر پیاده شده. **علاوه بر آن:** TWA تب‌دار کامل، My Assets اولویتی، Suggestions هوشمند با prefill، چارت پیشرفته، بهبود عمیق بات chat (asset-grouped + لینک TWA) — همه به عنوان بهترین تجربه تولید برای کاربر ایرانی.
- [ ] فاز دو: سخت‌سازی منطق هشدار و جلوگیری از تکرار (T-201 تا T-205 P0 اصلی) — gating و برخی guards وجود دارد، اما state machine کامل، atomic claim/locking، idempotency قوی و anti-duplicate production-grade هنوز نیاز به تکمیل/تقویت دارد (P0 حیاتی).
- [ ] فاز سه: Observability، Data Freshness و آمادگی عملیاتی (T-301/T-303 + T-401 تا T-404 P0) — لاگ پایه، health، ingest، GH monitor، backup، healthcheck وجود دارد. نیاز به: schema لاگ ساختاریافته کامل، metricهای غنی، freshness status صریح + classification در DB/runtime، correlation/trace قوی، runbook مکتوب، alerting داخلی.
- [ ] فاز چهار: هم‌ترازی مستندات، تثبیت نهایی و آماده‌سازی برای توسعه بعدی (T-501 تا T-504) — نیاز به audit کامل docs/runtime، walkthrough واقعی end-to-end (happy + error + stale + duplicate + failure)، test matrix، release checklist، baseline پایدار.

**اولویت فعلی (موج اول گزارش):** تکمیل فاز دو (reliability P0) + فاز سه (observability + freshness) + مستندسازی رسمی قراردادها (Asset Identity Policy، Pricing Presentation Policy، Flow/Lifecycle/Freshness Contract).

## چیزهایی که از گزارش‌های بهبود مبنا هستند (01-06)

- محصول برای کاربر واقعی ایرانی: تومان واحد اصلی، قیمت قابل فهم + هماهنگ عرف بازار، explicit در همه نقاط حساس.
- ۹ مسئله اصلی: ابهام دارایی، ابهام Alert Flow، تکرار هشدار، stale data، ضعف observability، عدم هم‌ترازی docs، ضعف متن‌ها/تاییدها، نبود policy قیمت، ریسک بیش‌توسعه قبل از تثبیت.
- اصل: Explicit > Implicit؛ یکدست‌سازی؛ اول hardening بعد expansion؛ متن بخشی از reliability؛ docs = runtime.
- فازبندی دقیق ۵ فاز + task breakdown با کد T-xxx + P0/P1/P2 + owner + AC + sprint ۵ هفته‌ای + KPI (duplicate rate → 0، completion rate، stale rate، MTTR و ...) + Risk Register.
- هیچ MVP مصنوعی؛ محصول کامل از روز اول، اما با ترتیب درست (قرارداد → UX → backend hardening → observability → audit/release).

## جهت‌گیری تولید و کارهای غنی انجام‌شده

- تمام تمرکز روی **شفافیت رفتاری، کنترل‌پذیری فنی، قابلیت اعتماد عملیاتی** + **بهترین UX/UI و کارایی ممکن** برای کاربران واقعی.
- TWA به عنوان تجربه اصلی غنی (تب‌دار، asset-centric My Assets، smart suggestions، interactive multi-asset charts) + بات متنی یکپارچه.
- کارایی: ingest خودکار، history endpoint + چارت، پیش‌بارگذاری/کش در TWA، اقدام سریع از My Assets/Suggestions.
- گسترش دارایی‌ها: با کیفیت (mapping کامل Binance/TGJU) و تست‌شده؛ گسترش هوشمند بر اساس تقاضا.
- آماده رشد: بعد از تکمیل فازهای ۲-۴، backlog بعدی (alert پیشرفته‌تر، portfolio view، personalization و غیره) روی هسته قابل اعتماد ساخته شود.

## مرجع‌های زنده

- [Implementation Roadmap](IMPLEMENTATION_ROADMAP_FA.md) (مستقیماً از گزارش فیکس‌شده)
- [User Guide](USER_GUIDE_FA.md)
- [Architecture](ARCHITECTURE.md)
- [API](API.md)
- [Deployment](DEPLOYMENT.md)
- [Operations](OPERATIONS.md)
- [Observability](OBSERVABILITY.md)

**گزارش کامل بهبود:** `/home/dev13/Documents/my-doc/PROJECT_IMPROVEMENT_REPORT_FA/` (01-06) — همیشه اول این را بخوانید.
