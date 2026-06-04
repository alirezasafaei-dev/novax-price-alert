# 🚀 تست سریع بات - آماده برای استفاده!

## ✅ وضعیت: بات فعال است!

**Bot:** @novax_price_bot  
**Webhook:** ✅ Configured  
**Worker:** ✅ Live  
**Cron:** ✅ Active (هر 10 دقیقه)

---

## 📱 تست در تلگرام (5 دقیقه)

### تست 1: شروع بات (30 ثانیه)
1. در تلگرام جستجو کنید: `@novax_price_bot`
2. دکمه **Start** را بزنید
3. **انتظار:** منوی 4 دکمه‌ای ببینید

### تست 2: مشاهده قیمت کریپتو (1 دقیقه)
1. کلیک روی `💰 قیمت‌ها`
2. کلیک روی `₿ کریپتو`
3. **انتظار:** قیمت BTC, ETH, SOL, BNB

### تست 3: تنظیم هشدار (2 دقیقه)
1. کلیک روی `🔔 تنظیم هشدار`
2. کلیک روی `₿ کریپتو`
3. کلیک روی `BTC`
4. کلیک روی `بالاتر از`
5. تایپ کنید: `1`
6. کلیک روی `✅ تایید و ذخیره`
7. **انتظار:** پیام "هشدار ذخیره شد"

### تست 4: مشاهده هشدارها (30 ثانیه)
1. کلیک روی `📋 هشدارهای من`
2. **انتظار:** هشدار ساخته شده در تست 3 را ببینید

### تست 5: دریافت هشدار (حداکثر 10 دقیقه)
1. صبر کنید تا cron اجرا شود
2. **انتظار:** پیام هشدار دریافت کنید:
   ```
   🔔 هشدار قیمت!
   
   BTC به {قیمت} رسید
   شرط شما: بالاتر از 1
   
   این هشدار غیرفعال شد.
   ```

---

## 🔍 بررسی فنی

### Health Check
```bash
curl https://novax-telegram-relay.asdevelooper.workers.dev/health
```
**انتظار:** `{"status":"ok","service":"telegram-bot"}`

### Webhook Info
```bash
curl https://novax-telegram-relay.asdevelooper.workers.dev/setup-webhook | jq .
```
**انتظار:** `"url": "https://novax-telegram-relay.asdevelooper.workers.dev/webhook"`

### Live Logs
```bash
cd deploy/cloudflare-worker
export CLOUDFLARE_API_TOKEN=<YOUR_CLOUDFLARE_API_TOKEN>
npx wrangler tail
```

---

## ✨ امکانات آماده

- ✅ منوی دکمه‌ای تعاملی
- ✅ قیمت‌های real-time (کریپتو، ارز، طلا)
- ✅ Wizard تنظیم هشدار
- ✅ بررسی خودکار هر 10 دقیقه
- ✅ ارسال پیام هشدار
- ✅ مدیریت هشدارها

---

## 📊 نتیجه تست

پس از انجام تست‌ها:

- [ ] تست 1: شروع بات ✅
- [ ] تست 2: مشاهده قیمت ✅
- [ ] تست 3: تنظیم هشدار ✅
- [ ] تست 4: مشاهده هشدارها ✅
- [ ] تست 5: دریافت هشدار ✅

**اگر همه تست‌ها موفق بود: بات آماده استفاده عمومی است! 🎉**

---

## 🐛 عیب‌یابی

### بات پاسخ نمی‌دهد
```bash
# بررسی webhook
curl https://novax-telegram-relay.asdevelooper.workers.dev/setup-webhook | jq .result.pending_update_count
```
اگر عدد بالایی بود، webhook مشکل دارد.

### هشدار ارسال نمی‌شود
```bash
# بررسی cron در Cloudflare Dashboard
# Workers → novax-telegram-relay → Triggers → Cron Triggers
```

### مشاهده خطاها
```bash
cd deploy/cloudflare-worker
npx wrangler tail --format pretty
```

---

**بات آماده است! شروع کنید: @novax_price_bot** 🚀
