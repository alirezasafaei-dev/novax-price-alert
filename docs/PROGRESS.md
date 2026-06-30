# وضعیت پیشرفت

آخرین بازبینی: 2026-06-30 ( deploy record added )

این سند وضعیت فعلی پروژه را خلاصه می‌کند. گزارش‌ها، چک‌لیست‌ها و راهنماهای مرحله‌ای قدیمی در
`docs/archive/` نگهداری می‌شوند و نباید بدون بررسی کد واقعی به عنوان منبع اجرا استفاده شوند.

## وضعیت فعلی محصول

- مسیر production روی Cloudflare Worker + D1 متمرکز است.
- Cloudflare D1 منبع اصلی هشدارها، کاربران، رخدادها، پرداخت‌ها، subscriptionها و snapshotهای قیمت است.
- KV فقط برای assetهای مینی‌اپ، session و cache کم‌ریسک استفاده می‌شود و namespaceها باید جدا باشند.
- مینی‌اپ از Worker روی `/mini-app/` و assetهای KV سرو می‌شود؛ برای WebViewهای حساس تلگرام یک fallback کلاسیک `legacy-app.js` هم در HTML قرار دارد.
- بات تلگرام menu-driven است و قیمت‌ها، ساخت هشدار، مدیریت هشدار و پرداخت دستی را پوشش می‌دهد.
- cron Worker هر دقیقه اجرا می‌شود؛ مانیتور GitHub هر ۵ دقیقه با cooldown هشدار می‌دهد؛ پلن Free هر ۱۰ دقیقه و پلن Pro هر ۱ دقیقه واجد بررسی است.
- قیمت کریپتو از Binance با واحد `USDT` و قیمت تتر/فیات/طلا از TGJU با واحد تومان خوانده می‌شود.
- history نمایشی از snapshot واقعی D1 ساخته می‌شود؛ داده مصنوعی history نباید دوباره وارد محصول شود.

## آخرین تغییرات مهم

### 2026-06-30: Hardening PR merge و اولین deploy پروداکشن

- PR #34 `Harden Cloudflare Worker production path` با squash merge شد.
- 3 KV namespace جداگانه ایجاد شد: `novax-miniapp-assets` (ASSETS_KV)، `novax-sessions` (SESSIONS_KV)، `novax-users-cache` (USERS_KV).
- Worker code deploy شد: webhook تنظیم، health OK، cron فعال (`* * * * *`)، D1 متصل.
- Secrets آپلود شد: TELEGRAM_BOT_TOKEN، TELEGRAM_SECRET_TOKEN، SETUP_SECRET، ADMIN_TELEGRAM_USER_IDS، PAYMENT_INSTRUCTIONS.
- Mini-app assets هنوز آپلود نشده (Cloudflare KV free tier daily write limit). اجرای مجدد `deploy-miniapp-worker-kv.sh` فردا الزامی است.
- wrangler.toml در repo فقط placeholder دارد ( real IDs در Cloudflare ذخیره شده‌اند ).
- اقدامات hardening: CORS allowlist، malformed webhook 400، duplicate update guard، D1 fail-closed، Telegram API timeout/retry، structured logging بدون secrets.

### 2026-06-27: احیای بات و رفع صفحه سفید مینی‌اپ تلگرام

- webhook تلگرام دوباره تنظیم شد. چون Telegram برای `workers.dev` خطای DNS موقت داشت، webhook با `ip_address` resolved شده Cloudflare ثبت شد.
- Worker secrets مربوط به مینی‌اپ (`NOVAX_MINI_APP_URL` و `MINI_APP_URL`) تنظیم شدند تا دکمه `🌐 داشبورد هوشمند` در بات فعال شود.
- مشکل صفحه سفید مینی‌اپ با دو اصلاح بسته شد:
  - حذف اولویت embedded assets قدیمی در Worker و برگشت به source of truth فعلی یعنی KV.
  - افزودن fallback کلاسیک `assets/legacy-app.js` کنار bundle ماژولی Vite. اگر Telegram WebView نتواند module/chunk اصلی را mount کند، fallback بعد از تأخیر کوتاه React app را mount می‌کند.
- برای جلوگیری از SyntaxError در WebViewهای قدیمی، build مینی‌اپ بعد از Vite با esbuild به target `es2015` post-process می‌شود و عبارت مبهم `TON"?.05` از سورس حذف شد.
- build مخصوص Worker اکنون `npm run build:worker` است و خروجی آن باید به KV sync شود.

### 2026-06-26: پاکسازی و ساماندهی مستندات

- `README.md` به entrypoint کوتاه و فعلی تبدیل شد.
- `docs/README.md` به index مستندات زنده تبدیل شد.
- `docs/PROGRESS.md` از لاگ طولانی و قدیمی به خلاصه وضعیت قابل اعتماد تبدیل شد.
- راهنماهای deployment قدیمی، گزارش‌ها، quick referenceها و چک‌لیست‌های تکراری به `docs/archive/` منتقل شدند.
- نشانه‌های حساس در مستندات فعلی بررسی و redaction اولیه انجام شد.

### 2026-06-25: D1 product core and monetization

- schema درآمدی برای users، alerts، alert events، subscriptions، payment requests، price snapshots و admin audit اضافه شد.
- claim اتمیک هشدار، lease پنج‌دقیقه‌ای، retry محدود و idempotency رخداد ارسال پیاده شد.
- endpointهای setup به POST + secret محدود شدند و نبود webhook secret باعث 503 می‌شود.
- FastAPI legacy هنگام قطع PostgreSQL دیگر به SQLite محلی fallback نمی‌کند.
- production deploy شد و D1، cron، webhook و snapshotهای واقعی قیمت بررسی شدند.

### 2026-06-24: مینی‌اپ روی Worker

- React mini-app از Worker/KV روی `/mini-app/` سرو می‌شود.
- Worker APIهای لازم برای latest/history prices و alertهای سبک را expose می‌کند.
- داده حساس AI یا کلید provider نباید وارد browser bundle شود.

## اعتبارسنجی ثبت‌شده

آخرین اجرا: 2026-06-30 (پس از merge PR #34):

- Python unit/integration: 153 passed
- Worker test suites: 8 suites all passed (log, metrics-alerting, heartbeat, product-db, miniapp-api, miniapp-static, telegram-relay, new-bot)
- Mini-app: lint 0 errors, tests 3/3 passed, build OK
- Bandit: 0 high/medium issues
- pip-audit: 0 known vulnerabilities
- npm audit (worker + mini-app): 0 vulnerabilities
- Worker deploy: health OK, webhook OK, D1 connected, cron active

برای هر تغییر جدید، وضعیت واقعی باید دوباره با تست‌های مرتبط و inspection کد تأیید شود.

## وضعیت امنیت مستندات

Canonical status رخداد Telegram token: **باز**. تا وقتی rotation و پاکسازی تاریخچه remote با شواهد عملیاتی تأیید نشده، هیچ سند دیگری نباید آن را closed بداند. حذف از فایل‌های فعلی کافی نیست؛ GitHub history، cloneها، forkها، cacheها و logها ممکن است مقدار قدیمی را نگه داشته باشند.

اقدام لازم برای بستن incident:

1. token بات را از BotFather revoke/rotate کنید.
2. secret جدید را فقط در secret managerهای runtime مثل Cloudflare/GitHub Actions تنظیم کنید.
3. webhook و deploy production را با secret جدید refresh کنید.
4. بعد از rotation، تاریخچه git با ابزارهایی مثل `git filter-repo` یا BFG پاکسازی و force-push هماهنگ انجام شود.
5. همه cloneهای تیمی باید بعد از rewrite دوباره sync/re-clone شوند.

## منابع زنده

- `README.md`
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/OPERATIONS.md`
- `docs/OBSERVABILITY.md`
- `docs/SECURITY.md`
- `docs/CONTRACTS_AND_POLICIES.md`
- `docs/USER_GUIDE_FA.md`

هر سندی خارج از این لیست، مخصوصاً داخل `docs/archive/`، فقط مرجع تاریخی است.
