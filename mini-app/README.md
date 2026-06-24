# Novax Mini-App (داشبورد هوشمند)

این مینی‌اپ React + Vite برای اجرا داخل Telegram WebApp آماده شده است. مسیر production فعلی، سرو استاتیک از Cloudflare Worker روی `/mini-app/` و اتصال به همان Worker است تا تجربه Telegram از VPS ایرانی جدا شود.

## وضعیت فعلی

- قیمت‌های زنده از `VITE_NOVAX_API_BASE/api/v1/prices/latest` خوانده می‌شوند.
- هشدارها در LIVE با `X-Telegram-Init-Data` واقعی Telegram WebApp به Worker وصل می‌شوند.
- رویدادهای هشدار از `GET /api/v1/alerts/events` می‌آیند.
- SIM mode محلی برای تست سریع بدون بک‌اند باقی مانده است.
- AI در Pages بدون endpoint امن خارجی safe-degrade می‌شود تا `GEMINI_API_KEY` وارد مرورگر نشود.

## اجرای محلی

```bash
cd mini-app
npm install
npm run dev
```

سپس در `http://localhost:3012` باز کنید.

## بیلدها

برای حالت قدیمی Node/Express:

```bash
npm run build
npm start
```

برای Cloudflare Pages یا Worker-hosted static:

```bash
npm run build:pages
```

تنظیمات Pages:

- Root directory: `mini-app`
- Build command: `npm ci && npm run build:pages`
- Output directory: `dist`
- Env: `VITE_NOVAX_API_BASE=https://<worker-domain>`

## AI Analyst

- `GEMINI_API_KEY` فقط server-side مجاز است و نباید در bundle Pages قرار بگیرد.
- برای فعال‌سازی AI، یک endpoint خارجی امن بسازید و `VITE_NOVAX_CHAT_API_BASE` را به base URL آن تنظیم کنید.

## مرجع

- راهنمای عملیاتی: `../docs/CLOUDFLARE_PAGES_MINI_APP.md`
