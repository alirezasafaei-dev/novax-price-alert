# گزارش پیشرفت بات تلگرام - ۱۴۰۵/۰۳/۱۱

## وضعیت فعلی ✅

### کارهای تکمیل شده

1. **راه‌اندازی کامل بات**
   - بات تلگرام: `@novax_price_bot`
   - Cloudflare Worker: `https://novax-telegram-relay.asdevelooper.workers.dev`
   - Webhook فعال و کار می‌کند
   - KV Storage برای alerts, sessions, users

2. **منوی اصلی**
   - ✅ 💰 قیمت‌ها - کار می‌کند
   - ✅ 🔔 تنظیم هشدار - session flow دارد
   - ✅ 📋 هشدارهای من - لیست و حذف
   - ✅ ❓ راهنما - نمایش راهنما

3. **نمایش قیمت (مطابق USER_GUIDE)**
   - ✅ کریپتو از **Binance** با واحد **USDT**: BTC, ETH, SOL, BNB
   - ✅ ارز از **TGJU** به **تومان**: دلار (USD)، یورو (EUR)
   - ✅ طلا از **TGJU** به **تومان**: طلای ۱۸ عیار، سکه امامی
   - ✅ تاریخ و ساعت به وقت تهران

4. **سیستم هشدار**
   - ✅ ذخیره هشدار در KV
   - ✅ نمایش لیست هشدارها
   - ✅ Cron job هر ۱۰ دقیقه
   - ✅ ارسال پیام هشدار به کاربر

## مشکلات حل شده

1. ✅ **Callback query error** - اصلاح `callback_data` به `data`
2. ✅ **منبع کریپتو** - تغییر به Binance (واحد USDT) مطابق USER_GUIDE
3. ✅ **endpoint مرده‌ی TGJU** - endpoint قدیمی HTTP 500 می‌داد؛ به آینه‌های `call2/call3/call1.tgju.org/ajax.json` با fallback سوئیچ شد
4. ✅ **ناوبری بازگشت** - دکمه‌ی بازگشت در مرحله‌ی شرط (`back:asset`) درست شد
5. ✅ **حذف هشدار** - دکمه‌ی 🗑 حذف + قیمت فعلی برای هر هشدار
6. ✅ **Session conflict** - clearSession قبل از نمایش قیمت
7. ✅ **Import error** - اضافه کردن clearSession به imports

## مشکلات باقی‌مانده

هیچ مورد باقی‌مانده‌ای نیست — موارد قبلی برطرف شدند:
- ✅ فلوی هشدار کامل و مرحله‌ای شد (بازار → دارایی → شرط → قیمت → تایید).
- ✅ نرخ ثابت حذف شد؛ ارز/طلا زنده از TGJU و کریپتو USDT از Binance.
- ✅ retry/backoff برای کاهش خطای rate limit اضافه شد.

## فایل‌های تغییر یافته

```
deploy/cloudflare-worker/src/callbacks.js  - اصلاح handleCallback و handleTextInSession
deploy/cloudflare-worker/src/index.js      - اضافه کردن clearSession
deploy/cloudflare-worker/src/keyboards.js  - دکمه‌های بازار/دارایی (BTC/ETH/SOL/BNB، USD/EUR، طلا) + بازگشت/حذف
deploy/cloudflare-worker/src/prices.js     - Binance (کریپتو) + TGJU آینه‌ای (ارز/طلا)
docs/PROGRESS.md                           - مستندات پیشرفت
proxy/                                     - فایل‌های proxy (آماده برای آینده)
```

## TODO بعدی

1. [x] اصلاح فلوی هشدار (اجباری کردن انتخاب بازار/دارایی/شرط)
2. [x] اضافه کردن دکمه بازگشت در هر مرحله
3. [x] منبع زنده‌ی قیمت (Binance برای کریپتو، TGJU برای ارز/طلا)
4. [x] تست cron job (تست زنده تأیید شد — هشدار در بازه‌ی ۰ تا ۱۰ دقیقه ارسال شد)
5. [ ] (اختیاری) metrics و تاریخچه‌ی قیمت

## نکات فنی

- کریپتو: `data-api.binance.vision/api/v3/ticker/price?symbol=<COIN>USDT`
- ارز/طلا: TGJU آینه‌ای (`call2/call3/call1.tgju.org/ajax.json`)؛ مقادیر زیر کلید `current` و به‌صورت رشته‌ی کامادار (ریال) → تقسیم بر ۱۰ برای تومان
- Cloudflare Worker از IP خارجی است
- KV Storage کار می‌کند و پایدار است
- Webhook و Cron فعال و کار می‌کنند
- Session management برای جلوگیری از conflict اضافه شد

---

## ۱۴۰۵/۰۳/۱۱ - ۲۱:۰۷

### ✅ رفع باگ نمایش "null"

**مشکل**: هنگام کلیک روی دکمه‌ها، متن "null" قبل از پاسخ نمایش داده می‌شد

**علت**: `answerCallbackQuery` با `text: null` فراخوانی می‌شد و تلگرام آن را به صورت رشته "null" نمایش می‌داد

**راه‌حل**:
- اصلاح `src/telegram.js`: حذف پارامتر `text` از body اگر null باشد
- اصلاح `src/callbacks.js`: ارسال string خالی به جای null

**نتیجه**: ✅ دکمه‌ها بدون نمایش "null" کار می‌کنند

**Commit**: `f946f68` - "fix: حذف نمایش null در callback query ها"

**Deploy**: ✅ Version `de3c1302-01e3-4d5c-9a83-c180ccb6cfed`

