# 🚀 راهنمای شروع سریع

> برای ادامه کار بدون توکن‌سوزی - ابتدا این فایل را بخوانید

## ✅ وضعیت فعلی

**بات آماده و در حال کار است:**
- بات: `@novax_price_bot` ✅ کار می‌کند
- Worker: `https://novax-telegram-relay.asdevelooper.workers.dev`
- آخرین commit: `f946f68` - رفع باگ null

**قابلیت‌های فعال:**
- ✅ نمایش قیمت 6 ارز کوچک (USDT, DOGE, SHIB, TRX, ADA, DOT)
- ✅ سیستم هشدار با cron هر 10 دقیقه
- ✅ منوی کامل با 4 دکمه
- ✅ رفع باگ نمایش "null" در دکمه‌ها

---

## 🎯 مراحل بعدی (به ترتیب اولویت)

### 1️⃣ بهبود نرخ تبدیل (اولویت بالا)
**مشکل**: نرخ دلار به تومان ثابت است (175,000)

**گزینه‌ها**:
- A: پیدا کردن API واقعی نرخ دلار (bonbast, tgju, ...)
- B: به‌روزرسانی دستی هفتگی
- C: راه‌اندازی proxy در VPS

**فایل**: `src/prices.js` - خط 23

### 2️⃣ اضافه کردن دکمه لغو در فلوی هشدار
### 3️⃣ بهبود مدیریت خطا و retry logic

---

## 📂 فایل‌های کلیدی

```
src/
├── index.js       → ورودی اصلی، routing
├── callbacks.js   → مدیریت دکمه‌ها و session
├── prices.js      → دریافت قیمت از CoinGecko
├── alerts.js      → مدیریت هشدارها
├── cron.js        → بررسی هشدارها هر 10 دقیقه
└── keyboards.js   → تعریف دکمه‌ها
```

---

## 🔧 دستورات ضروری

### دیپلوی
```bash
cd deploy/cloudflare-worker
export CLOUDFLARE_API_TOKEN=<YOUR_CLOUDFLARE_API_TOKEN>
export CLOUDFLARE_ACCOUNT_ID=<YOUR_CLOUDFLARE_ACCOUNT_ID>
npx wrangler deploy
```

### مشاهده لاگ
```bash
npx wrangler tail --format pretty
```

### تست بات
1. باز کردن `@novax_price_bot` در تلگرام
2. `/start`
3. "💰 قیمت‌ها" → "₿ کریپتو"

---

## 🐛 مشکلات رایج

| مشکل | راه‌حل |
|------|--------|
| دکمه کار نمی‌کند | بررسی لاگ، احتمالاً session قدیمی |
| قیمت نمایش نمی‌دهد | بررسی CoinGecko API (نیاز به User-Agent) |
| هشدار کار نمی‌کند | بررسی cron log، KV storage |

---

## 📝 قبل از شروع کار

1. ✅ `git log -1` - بررسی آخرین commit
2. ✅ خواندن `docs/PROGRESS.md` - وضعیت دقیق
3. ✅ تست بات در تلگرام - آیا کار می‌کند؟
4. ✅ خواندن `README.md` - اطلاعات کامل

---

## 💡 نکات مهم

- **هرگز** `.env` را commit نکن
- **همیشه** قبل از commit تست کن
- **حتماً** لاگ را بررسی کن
- **به‌روزرسانی** `docs/PROGRESS.md` بعد از هر تغییر

---

## 🔗 لینک‌های سریع

- [README کامل](README.md)
- [گزارش پیشرفت](docs/PROGRESS.md)
- [بات تلگرام](https://t.me/novax_price_bot)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)

---

**آخرین به‌روزرسانی**: ۱۴۰۵/۰۳/۱۱
**وضعیت**: ✅ Production
