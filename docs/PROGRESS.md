# وضعیت پیشرفت

آخرین بازبینی: 2026-07-07 (پورتفولیو + AI Chat آنالایزر endpoint + دیپلوی نهایی)

این سند وضعیت فعلی پروژه را خلاصه می‌کند. گزارش‌ها، چک‌لیست‌ها و راهنماهای مرحله‌ای قدیمی در
`docs/archive/` نگهداری می‌شوند و نباید بدون بررسی کد واقعی به عنوان منبع اجرا استفاده شوند.

## وضعیت فعلی محصول

- مسیر production روی Cloudflare Worker + D1 متمرکز است.
- Cloudflare D1 منبع اصلی هشدارها، کاربران، رخدادها، پرداخت‌ها، subscriptionها و snapshotهای قیمت است.
- KV فقط برای assetهای مینی‌اپ، session و cache کم‌ریسک استفاده می‌شود و namespaceها باید جدا باشند.
- مینی‌اپ از Worker روی `/mini-app/` و assetهای KV سرو می‌شود؛ برای WebViewهای حساس تلگرام یک fallback کلاسیک `legacy-app.js` هم در HTML قرار دارد.
- بات تلگرام menu-driven است و قیمت‌ها، ساخت هشدار، مدیریت هشدار، پرداخت دستی و تحلیل هوشمند را پوشش می‌دهد.
- تحلیلگر هوشمند مینی‌اپ (`/api/chat`) روی Worker اجرا می‌شود؛ از Groq AI برای تحلیل استفاده می‌کند و در صورت عدم دسترسی، پاسخ‌های محلی با قیمت‌های واقعی برمی‌گرداند.
- پورتفولیو با انتخاب دارایی از dropdown گروه‌بندی شده (رمزارز/فیات/طلا) و ذخیره در localStorage کار می‌کند.
- cron Worker هر ۱ ساعت اجرا می‌شود (`0 * * * *`)؛ اینترنال heartbeat روی ۳۶۰۰ ثانیه تنظیم شده؛ هدف کاهش مصرف رایگان Cloudflare Workers.
- مسیر جایگزین برای VPS خارج از ایران: Docker Compose شامل PostgreSQL, Redis, FastAPI API, Worker, Nginx.
- worker و price-fetch در VPS هم هر ۳۶۰۰ ثانیه یک بار اجرا می‌شوند و از طریق env var `WORKER_INTERVAL_SECONDS` قابل تنظیم هستند.
- قیمت کریپتو از Binance با واحد `USDT` و قیمت تتر/فیات/طلا از TGJU با واحد تومان خوانده می‌شود.
- history نمایشی از snapshot واقعی D1 ساخته می‌شود؛ داده مصنوعی history نباید دوباره وارد محصول شود.

## آخرین تغییرات مهم

### 2026-07-07 (جلسه سوم): رفع پورتفولیو + endpoint تحلیلگر هوشمند + دیپلوی نهایی

**رفع پورتفولیو (انتخاب دارایی):**
- فیلد متنی `نماد دارایی` (که کاربر باید دستی "BTC" یا "USD_IRT" تایپ کند) → `<select>` گروه‌بندی شده با همه دارایی‌ها (رمزارز / فیات / طلا)
- لیبل `مقدار` حالا نام دارایی انتخاب شده را نشان می‌دهد: `مقدار (BTC)`
- در لیست دارایی‌ها، واحد (symbol) کنار مقدار هر دارایی درج شد

**AI Chat endpoint روی Worker:**
- endpoint `/api/chat` به Worker index.js اضافه شد (POST با `{ message, chatHistory }`)
- دریافت قیمت‌های لحظه‌ای از `prices.js` (همان منبع API اصلی)
- یکپارچه‌سازی با Groq API (مدل `mixtral-8x7b-32768`) برای پاسخ هوشمند
- fallback محلی برای BTC, ETH, Gold, و نمای کلی بازار وقتی Groq در دسترس نیست (هر دو زبان فارسی/انگلیسی)
- لاگ خطاهای Groq در `logError`

**رفع AIChat.tsx:**
- وقتی `VITE_NOVAX_CHAT_API_BASE` خالی است (Static/KV deploy)، به جای undefined از `window.location.origin` استفاده می‌کند
- بلاک dead code "تحلیل‌گر AI در دیپلوی استاتیک فعلاً به endpoint امن وصل نیست" حذف شد

**دیپلوی assets:**
- مینی‌اپ با تغییرات بازبینی و بیلد شد (chunk هش: `index-B5b-pO0Q.js`)
- ۹ فایل asset + manifest با Cloudflare REST API به ASSETS_KV آپلود شدند (wrangler v4 syntax تغییر کرده بود)
- Worker دپلوی شد (Version ID: `583f636d`)

**وضعیت نهایی:**
- مینی‌اپ: `/mini-app/` ۲۰۰, JS/CSS همگی ۲۰۰
- AI Chat: `/api/chat` ۲۰۰ با پاسخ‌های هوشمند + real-time prices
- پورتفولیو: انتخاب دارایی با dropdown گروه‌بندی شده
- Worker: health 200, prices/latest 200, webhook فعال, cron ساعتی
- تمام assetها و manifest در KV با ۲۰۰ تأیید شدند

### 2026-07-07 (جلسه دوم):审计 و رفع مشکل assets مینی‌اپ + مستندسازی نهایی

**مشکل مینی‌اپ (Assets 404):**
- assets مینی‌اپ (JS/CSS) در ASSETS_KV نبودند و فقط index.html سرو می‌شد → ۶ فایل asset به KV آپلود شدند و همه HTTP 200 شدند.
- manifest assets هم به KV آپلود شد تا `miniapp-static.js` از cache محلی استفاده کند.
- تأیید نهایی: HTML شامل `<script src="/mini-app/assets/index-Dg69A40Q.js">` و `<link href="/mini-app/assets/index-B-VlLaBb.css">` است و هر دو ۲۰۰ برمی‌گردانند.

**اصلاح wrangler.toml (git ref):**
- `CI_COMMIT_REF_NAME` و `refs/heads/master` به `main` تغییر یافت (قبلاً اشاره به tag master/branch ناموجود داشت).

**اصلاح `docker-compose.ir-vps.yml`:**
- build.context از `./` به `.` اصلاح شد تا docker compose بدون خطا اجرا شود.
- سینتکس volumes اصلاح شد.

**اصلاح `settings.py`:**
- import گمشده `field_validator` از pydantic اضافه شد.

**تغییرات زیرساختی:**
- mini-app: `meta[name="viewport"]` اضافه شد (`maximum-scale=1, user-scalable=no`).
- Inline query handler: price info به همراه `reply_markup` با دکمه open mini-app برمی‌گرداند.
- Group message filter: فقط به `/commands`, @mention, reply-to-bot, یا keywords قیمت پاسخ می‌دهد.
- Promotion: بعد از ۳ بار تعامل NLP در گروه، دعوت به مینی‌اپ (یکبار/۶۰ روز) با `USERS_KV`.
- Heartbeat: `WORKER_INTERVAL_SECONDS` به ۳۶۰۰ تنظیم و heartbeat در cron جدید ذخیره می‌شود (نه cron قدیم).
- Privacy policy endpoint (`/privacy`) با HTML کامل هد设置了.

**اعتبارسنجی نهایی:**
- Worker endpoints: `/health` → 200, `/api/v1/prices/latest` → 200 (BTC, ETH, TON, ...), `/mini-app/` → 200 (HTML با اسکریپت‌ها), `/mini-app/assets/*` → 200.
- Webhook تلگرام ثبت و تأیید.
- Bot commands: start, help, prices, alerts, faq, mini-app.
- Bot settings: Inline mode ON, Privacy mode OFF, Menu button → web_app.

**پشتیبان‌گیری:**
- git bundle و tar.gz دوم از پروژه تهیه شد.

### 2026-07-07 (جلسه اول): NLP فارسی + Auto-post + آماده‌سازی VPS مستقل

**NLP و زبان عامیانه (فایل جدید `src/nlp.js`):**
- تشخیص intent با کیورد مپینگ فارسی/انگلیسی (قیمت، سلام، خداحافظ، تشکر، راهنما)
- درک جمله‌های طبیعی مثل "نواکس طلا چنده؟"، "قیمت بیت کوین"، "نواکس همه قیمت و بگو"
- پشتیبانی از اعداد فارسی و عربی
- پاسخ به صورت reply به پیام کاربر (message reply)
- **Groq AI fallback** (`mixtral-8x7b-32768`) برای queries پیچیده که کیورد نمی‌شناسد
- API Key: Groq (فری تایر ۳۰ RPM, ۱۴۴۰۰ RPD) به عنوان secret تنظیم شد
- سه حالت پاسخ: قیمت یک دارایی خاص / قیمت یک بازار / همه قیمت‌ها

**Auto-post خودکار (فایل جدید `src/auto-post.js`):**
- ارسال قیمت‌های لحظه‌ای به گروه/کانال در ساعت‌های مشخص (پیش‌فرض ۱۰, ۱۴, ۲۰ تهران)
- همراه با تبلیغ بات (CTA با لینک دعوت)
- Idempotent با KV: فقط یک بار در هر (chat_id, date, hour)
- کنترل با env vars: `AUTO_POST_ENABLED`, `AUTO_POST_CHAT_ID`, `AUTO_POST_HOURS`
- KV namespace جدید: `AUTO_POST_KV` (اشتراک با ALERTS_KV)

**تغییرات زیرساختی:**
- `telegram.js`: اضافه شدن `reply_to_message_id` به sendMessage
- `commands.js`: `handleUnknownMessage` حالا NLP صدا میزند، پیام fallback هوشمند
- `index.js`: ارسال متن پیام و message_id به handleUnknownMessage
- `cron.js`: اضافه شدن auto-post بعد از marketing post
- `wrangler.toml`: env vars جدید AUTO_POST_ENABLED, AUTO_POST_HOURS + KV binding
- دیپلوی نهایی Version ID: `c0ee41d0`

**کاهش بار Cloudflare:**
- cron Worker از `* * * * *` (هر دقیقه) به `0 * * * *` (هر ۱ ساعت)
- heartbeat interval ۶۰ → ۳۶۰۰ ثانیه

**بهبود پیکربندی VPS (بدون Docker):**
- فایل‌های جدید: `ecosystem.config.js`, `nginx.vps.conf`, `scripts/setup-vps.sh`
- `scripts/deploy-vps-only.sh`: بروزرسانی با uv sync + pm2 restart
- `docs/VPS_DEPLOYMENT.md`: راهنمای کامل PM2 + Nginx
- systemd service files: `deploy/novax-api.service`, `deploy/novax-worker.service`
- `mini-app/.env`: `VITE_NOVAX_API_BASE=` خالی (auto-detect origin)

**پشتیبان‌گیری:**
- git bundle و tar.gz کامل از پروژه تهیه شد.

### 2026-07-02: اصلاحات نهایی و deploy کامل

**مینی‌اپ - رفع صفحه خالی / لودینگ گیرکرده (Blank / Stuck Loading):**
- مشکل: بعد از تغییرات چارت و historyLabels، مینی‌اپ فقط placeholder «در حال بارگذاری داشبورد NovaX...» را نشان می‌داد و React mount نمی‌شد (نه HUD و نه محتوای واقعی).
- علت واقعی (با تست زنده از worker): 
  - المنت لودینگ به عنوان child داخل `<div id="root">` قرار گرفته بود → legacy fallback به خاطر `childElementCount > 0` بلاک می‌شد.
  - اسکریپت اصلی ESM (`type=module` + vendor chunks + rolldown-runtime) در WebView تلگرام در برخی موارد کامل اجرا نمی‌شد یا render را commit نمی‌کرد.
  - باندل‌های قدیمی در KV با HTML جدید mismatch داشتند.
- فیکس‌ها:
  - `mini-app/index.html`: `#root` خالی + لودینگ به صورت المنت جدا (`#app-loading` با position:fixed).
  - `mini-app/src/main.tsx`: گارد try/catch + حذف لودینگ قبل از createRoot + نمایش پیام خطای واضح فارسی به جای blank.
  - `mini-app/src/legacy-main.tsx`: حذف لودینگ + پاک کردن root + mount مقاوم (حتی اگر child داشته باشد).
  - `mini-app/src/App.tsx`: حذف ایمنی لودینگ در اولین mount.
  - `deploy/cloudflare-worker/src/miniapp-static.js`: وقتی index.html در KV نباشد، HTML تشخیصی با دستور دقیق deploy برمی‌گرداند.
  - `deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh`: verify چانک‌های vendor را هم HEAD می‌کند.
  - `mini-app/README.md`: یادآوری قوی که بعد از هر تغییر سورس مینی‌اپ باید اسکریپت کامل KV deploy اجرا شود.
- اقدامات عملی:
  - چندین بار بیلد `npm run build:worker` و اجرای کامل `deploy-miniapp-worker-kv.sh` توسط خود agent (با لود .env + ست کردن ASSETS_KV_ID از wrangler.toml).
  - تست واقعی با curl مستقیم از worker production (بررسی ساختار HTML، وجود legacy، محتوای باندل جدید، ۲۰۰ بودن assetها).
  - دیپلوی موفق (worker version جدید، assetها آپلود، manifest آپدیت، /mini-app/ و JSها ۲۰۰).
- نتیجه: ساختار درست شد. حالا main یا legacy لودینگ را حذف و UI واقعی را mount می‌کند.

**Infrastructure:**
- 3 KV namespace جداگانه ایجاد و فعال شد: `novax-miniapp-assets` (ASSETS_KV)، `novax-sessions` (SESSIONS_KV)، `novax-users-cache` (USERS_KV).
- Worker code با fixهای جدید deploy شد (Version ID: `2d37ae44`).
- Mini-app assets (۱۰ فایل + manifest) به ASSETS_KV آپلود شد.
- Webhook تلگرام تنظیم و تأیید شد (0 pending, 0 errors).
- Bot commands ثبت شد: /start, /help, /prices, /pro, /faq.

**Runtime hardening fixes:**
- `scheduled` handler: try/catch اضافه شد تا اگه `runCronJob` خطا بده، heartbeat هنوز ثبت بشه و `/status` از کار نیفته (`index.js`).
- `/setup-bot` endpoint: try/catch اضافه شد تا خطای `telegramApi` از fetch handler فرار نکنه (`index.js`).
- `miniapp-static` handler: try/catch اضافه شد تا KV خطا کل request رو خراب نکنه (`index.js`).
- import مرده `formatPrice` از `alerts.js` حذف شد.

**Mini-app fixes:**
- نمودار پیشرفته: labelهای نمونه ("نمونه 1، نمونه 2") با زمان واقعی از `historyLabels` جایگزین شد.
- `App.tsx`: زمان `observed_at` از history API استخراج و در `historyLabels` ذخیره می‌شود.
- `PriceBoard.tsx`: نمودار از `historyLabels` برای نمایش زمان واقعی استفاده می‌کنه.

**Validation:**
- Worker tests: 8/8 suites passed
- Mini-app tests: 3/3 passed, lint 0 errors, build OK
- Endpoints: health OK, status OK, prices 9 assets, mini-app 200, CORS working, auth 401, 404 correct

### 2026-06-30: Hardening PR merge و اولین deploy پروداکشن

- PR #34 `Harden Cloudflare Worker production path` با squash merge شد.
- 3 KV namespace جداگانه ایجاد شد: `novax-miniapp-assets` (ASSETS_KV)، `novax-sessions` (SESSIONS_KV)، `novax-users-cache` (USERS_KV).
- Worker code deploy شد: webhook تنظیم، health OK، cron فعال (`* * * * *`)، D1 متصل.
- Secrets آپلود شد: TELEGRAM_BOT_TOKEN، TELEGRAM_SECRET_TOKEN، SETUP_SECRET، ADMIN_TELEGRAM_USER_IDS، PAYMENT_INSTRUCTIONS.
- Mini-app assets آپلود شد (۹ فایل + manifest). Mini-app روی `/mini-app/` فعال و سالم است.
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

آخرین اجرا: 2026-07-07:

- Python unit/integration: 153 passed
- Worker test suites: 8 suites all passed (log, metrics-alerting, heartbeat, product-db, miniapp-api, miniapp-static, telegram-relay, new-bot)
- Mini-app: lint 0 errors, tests 3/3 passed, build OK
- Bandit: 0 high/medium issues
- pip-audit: 0 known vulnerabilities
- npm audit (worker + mini-app): 0 vulnerabilities
- Worker deploy: health OK, webhook OK, D1 connected, cron active
- Endpoints verified: health, status, prices/latest, mini-app/, /api/chat, CORS, auth, malformed webhook, 404
- Mini-app assets: index.html 200, JS (index-B5b-pO0Q.js) 200, CSS 200, legacy-app.js 200, manifest 200
- AI Chat: /api/chat POST با Groq + local fallback (BTC/ETH/Gold/market) تأیید شد
- Portfolio: انتخاب با dropdown گروه‌بندی شده (crypto/fiat/gold)

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
