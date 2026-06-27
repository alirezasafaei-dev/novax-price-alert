# دیپلوی خارجی مینی‌اپ روی Cloudflare

**وضعیت:** مسیر production فعلی برای حذف VPS ایرانی از تجربه Telegram Mini App، سرو مستقیم build مینی‌اپ از Cloudflare Worker روی `/mini-app/` است. assetها در `ALERTS_KV` sync می‌شوند و Worker آن‌ها را سرو می‌کند. Cloudflare Pages همچنان گزینه خوب بعدی است، اما در تست واقعی upload آن با خطای شبکه fail شد.

## معماری

```
Telegram → Cloudflare Worker
             ├─ webhook + bot menu
             ├─ /api/v1/prices/latest
             ├─ /api/v1/alerts*
             └─ cron alerts in KV

Telegram WebApp → Worker `/mini-app/` یا Cloudflare Pages → Worker API
```

## تنظیمات امن

- مقادیر واقعی `.env` را در خروجی، docs یا git ننویسید.
- Worker secrets از `.env` محلی فقط در deploy خوانده شوند:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_SECRET_TOKEN`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- برای نمایش دکمه مینی‌اپ در بات، مقدار زیر را به Worker secret/var بدهید:
  - `NOVAX_MINI_APP_URL=https://<pages-domain>` یا `https://<worker-domain>/mini-app/`
- برای build مینی‌اپ روی Pages، env عمومی زیر لازم است:
  - `VITE_NOVAX_API_BASE=https://<worker-domain>`

## Cloudflare Pages یا Worker-hosted

مسیر اجراشده فعلی:

- Build مینی‌اپ با base `/mini-app/` از طریق `npm run build:worker`
- Upload assetها به `ALERTS_KV`
- سرو `GET /mini-app/` و assetها از خود Worker
- اتصال API همان Worker با `VITE_NOVAX_API_BASE=https://<worker-domain>`
- HTML مینی‌اپ علاوه بر bundle ماژولی Vite، fallback کلاسیک `assets/legacy-app.js` دارد تا در Telegram WebViewهایی که module/chunk را درست mount نمی‌کنند صفحه سفید نماند.

Cloudflare Pages هنوز قابل استفاده است، اما تا وقتی upload ناپایدار است مسیر Worker+KV repeatableتر است.

### نکته مهم درباره صفحه سفید Telegram WebView

اگر در مرورگر عادی مینی‌اپ بالا می‌آید اما داخل Telegram فقط صفحه سفید دیده می‌شود، ابتدا این موارد را بررسی کنید:

- `GET /mini-app/` باید HTML شامل هر دو مورد زیر را برگرداند:
  - `assets/index-*.js`
  - `assets/legacy-app.js`
- `GET /mini-app/assets/legacy-app.js` باید `200` و `Content-Type: application/javascript` بدهد.
- `mini-app/src/components/PriceBoard.tsx` نباید دوباره literal مبهمی مثل `condition ? 0.05 : ...` تولید کند که minifier آن را شبیه optional chaining (`?.05`) کند؛ برای مقادیر حساس از شکل غیرمبهم مثل `5 / 100` استفاده شده است.
- `mini-app/index.html`، Telegram SDK را `async` لود می‌کند تا بارگیری کند یا ناموفق شود ولی parser و app را block نکند.

Fallback کلاسیک در این فایل‌ها پیاده‌سازی شده است:

- `mini-app/src/legacy-main.tsx`
- `mini-app/scripts/build-legacy-fallback.mjs`
- `mini-app/package.json` script `build:worker`

### Cloudflare Pages

در Cloudflare Pages:

- Root directory: `mini-app`
- Build command: `npm ci && npm run build:pages`
- Output directory: `dist`
- Environment variable: `VITE_NOVAX_API_BASE`

## Worker

Worker حالا APIهای لازم برای مینی‌اپ را دارد:

- `GET /api/v1/prices/latest`
- `GET /api/v1/prices/history`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts`
- `PATCH /api/v1/alerts/{id}`
- `DELETE /api/v1/alerts/{id}`
- `GET /api/v1/alerts/events`
- `GET /mini-app/` برای سرو مستقیم build مینی‌اپ از خود Worker در صورت نیاز

مسیرهای alerts از `X-Telegram-Init-Data` استفاده می‌کنند و با همان الگوریتم رسمی Telegram WebApp hash که در بک‌اند Python وجود دارد اعتبارسنجی می‌شوند.

نکته اجرایی: مسیر `POST /api/v1/alerts` در Worker هشدار را مستقیم در وضعیت `active` می‌سازد؛ کلاینت React دیگر call جداگانه `/confirm` نمی‌زند.

## اعتبارسنجی

مسیر production فعلی با Worker+KV:

```bash
deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh
```

این اسکریپت `.env` را secret-safe می‌خواند، مینی‌اپ را با base `/mini-app/` می‌سازد، assetها را با checksum/`sha256` به‌صورت idempotent در KV sync می‌کند، Worker را deploy می‌کند و webhook را verify می‌کند.

برای کاهش stale read در Worker، manifest با TTL کوتاه cache می‌شود. در صورت نیاز به debug فوری می‌توان `MINI_APP_MANIFEST_CACHE_SECONDS=0` را در runtime تنظیم کرد.

چک‌های دستی:

```bash
cd deploy/cloudflare-worker
npm test

cd ../../mini-app
npm run type-check
npm run build:worker
```

بعد از deploy:

```bash
curl -fsS https://<worker-domain>/health
curl -fsS https://<worker-domain>/api/v1/prices/latest
curl -fsS https://<worker-domain>/mini-app/
curl -fsS https://<worker-domain>/mini-app/assets/legacy-app.js
```

سپس از داخل Telegram، `/start` را بزنید و دکمه `🌐 داشبورد هوشمند` را باز کنید.
