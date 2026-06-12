# راهنمای کامل تنظیمات BotFather و بات تلگرام

## 🔍 مشکل GitHub Actions (اصلاح شد)

**مشکل**: پیام‌های "🚨 Novax monitor: endpoint check failed! Health: 000000, Status: 000000" در گروه

**علت**: GitHub Actions Workflow در تلاش برای چک کردن health endpoint بود اما secret `API_BASE_URL` تنظیم نشده بود.

**راه‌حل**: 
- GitHub Actions workflow به‌روزرسانی شد تا اگر secret تنظیم نشده باشد، چک را skip کند
- می‌توانید این workflow را در GitHub Repository settings → Secrets and variables → Actions غیرفعال کنید اگر نیاز ندارید

---

## 🤖 راهنمای تنظیمات BotFather

### مرحله 1: ایجاد بات جدید با BotFather

1. در تلگرام، به [@BotFather](https://t.me/BotFather) پیام دهید
2. دستور `/newbot` را بزنید
3. نام بات را انتخاب کنید (مثلاً: `NovaX Price Alert Bot`)
4. نام کاربری (username) را انتخاب کنید (مثلاً: `novax_price_bot` یا `NovaxPriceAlertBot`)
5. BotFather یک API Token به شما می‌دهد. آن را کپی و در جای امن نگه دارید.

**متن کپی برای BotFather:**
```
/newbot
NovaX Price Alert Bot
NovaxPriceAlertBot
```

---

### مرحله 2: تنظیمات اصلی بات

#### 2.1 تنظیمات توضیحات (About Text)

دستور `/setabouttext` را بزنید و این متن را وارد کنید:

```
📊 Novax Price Alert - ربات هشدار قیمت

✨ ویژگی‌ها:
• هشدار قیمت کریپتو (بیت‌کوین، اتریوم و...)
• هشدار قیمت طلا و ارز (تومان)
• هشدار مرحله‌ای با تایید صریح
• داشبورد هوشمند با چارت زنده
• قیمت‌ها هر 10 دقیقه آپدیت می‌شوند

🚀 شروع کنید:
/start - شروع بات
/price - دیدن قیمت‌ها
/alert - ایجاد هشدار قیمت

🌐 وب‌اپ: https://novax.alirezasafeidev.ir
```

---

#### 2.2 تنظیمات توضیحات دستورات (Command List)

دستور `/setcommands` را بزنید و این متن را وارد کنید:

```
start - شروع استفاده از بات 🚀
price - دیدن قیمت‌های فعلی 💰
alert - ایجاد هشدار قیمت 🔔
help - راهنما و پشتیبانی ❓
cancel - لغو عملیات در حال انجام ❌
```

---

#### 2.3 تنظیمات تصویری (Profile Picture)

دستور `/setuserpic` را بزنید و یک لوگو مناسب برای بات آپلود کنید.

---

### مرحله 3: تنظیمات پیشرفته (اختیاری)

#### 3.1 Privacy Mode

دستور `/setprivacy` را بزنید و گزینه `Disable` را انتخاب کنید. این کار اجازه می‌دهد بات در گروه‌ها و کانال‌ها پیام ارسال کند.

**متن BotFather:**
```
/setprivacy
Disable
```

#### 3.2 Group Privacy

دستور `/setjoingroups` را بزنید و `Enable` را انتخاب کنید تا بات بتواند به گروه‌ها اضافه شود.

**متن BotFather:**
```
/setjoingroups
Enable
```

#### 3.3 Inline Mode

دستور `/setinline` را بزنید و `Enable` را انتخاب کنید. این کار برای inline keyboard buttons ضروری است.

**متن BotFather:**
```
/setinline
Enable
```

#### 3.4 Inline Feedback

دستور `/setinlinefeedback` را بزنید و `Enable` را انتخاب کنید. این کار برای feedback از inline buttons مهم است.

**متن BotFather:**
```
/setinlinefeedback
Enable
```

---

## 🚨 قابلیت گروه/کانال

### وضعیت فعلی: ❌ پشتیبانی گروه/کانال ندارد

**تحلیل کد**: 
- بات Novax فعلاً فقط برای پیام‌های private chat طراحی شده است
- notification system از `user.telegram_user_id` استفاده می‌کند
- هیچ قابلیت برای ارسال به group chat یا channel وجود ندارد

**برای اضافه کردن قابلیت گروه/کانال نیاز به:**
1. جدول دیتابیس جدید برای groups/channels
2. Update در notification system برای پشتیبانی از group_chat_id و channel_username
3. Update در alert rules برای پشتیبانی از group-level alerts
4. Update در bot handlers برای مدیریت دستورات گروهی
5. Implement permission checks (admin-only commands در groups)

**این یک feature enhancement است که نیاز به توسعه دارد.**

---

## 🔧 تنظیمات بات در کد پروژه

### مرحله 4: تنظیم Environment Variables

در فایل `.env` پروژه، این متغیرها را تنظیم کنید:

```bash
# Bot Token از BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Relay URL (برای Cloudflare Worker)
TELEGRAM_RELAY_URL=https://your-worker.workers.dev
TELEGRAM_RELAY_SECRET=your-secret-key

# Ops Bot Token (برای GitHub Actions monitoring)
OPS_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
OPS_CHAT_ID=-1001234567890
```

---

## 📋 اسکریپت تنظیمات سریع

### اسکریپت 1: تنظیمات BotFather (کپی و پیست در BotFather)

```text
/newbot
NovaX Price Alert Bot
NovaxPriceAlertBot

/setabouttext
📊 Novax Price Alert - ربات هشدار قیمت

✨ ویژگی‌ها:
• هشدار قیمت کریپتو (بیت‌کوین، اتریوم و...)
• هشدار قیمت طلا و ارز (تومان)
• هشدار مرحله‌ای با تایید صریح
• داشبورد هوشمند با چارت زنده
• قیمت‌ها هر 10 دقیقه آپدیت می‌شوند

🚀 شروع کنید:
/start - شروع بات
/price - دیدن قیمت‌ها
/alert - ایجاد هشدار قیمت

🌐 وب‌اپ: https://novax.alirezasafeidev.ir

/setcommands
start - شروع استفاده از بات 🚀
price - دیدن قیمت‌های فعلی 💰
alert - ایجاد هشدار قیمت 🔔
help - راهنما و پشتیبانی ❓
cancel - لغو عملیات در حال انجام ❌

/setprivacy
Disable

/setjoingroups
Enable

/setinline
Enable

/setinlinefeedback
Enable
```

### اسکریپت 2: دستورات BotFather برای کپی (پیام به پیام)

```
/newbot
```
(نام بات: NovaX Price Alert Bot)
(username: NovaxPriceAlertBot)
(API Token را کپی کنید)

```
/setabouttext
```
(متن about از اسکریپت بالا را پیست کنید)

```
/setcommands
```
(متن commands از اسکریپت بالا را پیست کنید)

```
/setprivacy
```
(Disable را انتخاب کنید)

```
/setjoingroups
```
(Enable را انتخاب کنید)

```
/setinline
```
(Enable را انتخاب کنید)

```
/setinlinefeedback
```
(Enable را انتخاب کنید)

```
/setuserpic
```
(لوگو آپلود کنید)

---

## 🎯 دستورات پیشنهادی برای کاربران

### برای تنظیمات گروه:

اگر می‌خواهید بات را به یک گروه اضافه کنید:

1. در گروه، بات را دعوت کنید: `@NovaxPriceAlertBot`
2. Bot را admin کنید (پرامیشن: `/setprivacy` باید Disable باشد)
3. اکنون بات می‌تواند در گروه پیام دریافت کند (ولی کد هنوز پشتیبانی کامل ندارد)

### برای تنظیمات کانال:

1. به کانال مورد نظر بروید
2. Settings → Administrators → Add Administrator
3. بات را انتخاب کنید: `@NovaxPriceAlertBot`
4. Bot را admin کنید

---

## 📝 چک‌لیست نهایی

قبل از دیپلوی، این موارد را چک کنید:

- [ ] Bot با @BotFather ایجاد شده
- [ ] API Token در `.env` تنظیم شده
- [ ] About text تنظیم شده
- [ ] Commands list تنظیم شده
- [ ] Privacy mode روی Disable
- [ ] Join groups روی Enable
- [ ] Inline mode روی Enable
- [ ] Inline feedback روی Enable
- [ ] Profile picture آپلود شده
- [ ] بات در private chat تست شده
- [ ] همه دستورات کار می‌کنند
- [ ] GitHub Actions secrets تنظیم شده (اگر نیاز دارید)

---

## 🔧 رفع مشکل GitHub Actions

### راه‌حل 1: غیرفعال کردن Workflow

اگر به GitHub Actions monitoring نیاز ندارید:

1. به GitHub repository بروید
2. Settings → Actions → General
3. Workflow permissions: Disable all workflows
4. یا `.github/workflows/health-check-monitor.yml` را حذف کنید

### راه‌حل 2: تنظیم Secrets

اگر می‌خواهید فعال بماند:

1. Repository Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `API_BASE_URL`
4. Value: `https://novax.alirezasafeidev.ir`
5. همچنین `OPS_BOT_TOKEN` و `OPS_CHAT_ID` را تنظیم کنید

---

## 🚀 آماده‌سازی برای دیپلوی

### اسکریپت نهایی برای .env

```bash
# در فایل .env پروژه Novax
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_RELAY_URL=https://novax-relay.workers.dev
TELEGRAM_RELAY_SECRET=your-secret-key

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/novax

# Redis
REDIS_URL=redis://localhost:6379/0

# API
API_HOST=0.0.0.0
API_PORT=8001
APP_URL=https://novax.alirezasafeidev.ir

# Ops (اختیاری)
OPS_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
OPS_CHAT_ID=-1001234567890
METRICS_ACCESS_TOKEN=your-metrics-token
```

---

## ✅ نتیجه

- ✅ مشکل GitHub Actions شناخته و اصلاح شد
- ✅ قابلیت گروه/کانال بررسی شد (نیاز به توسعه دارد)
- ✅ راهنمای کامل BotFather آماده شد
- ✅ متن‌های قابل کپی ارائه شد
- ✅ پروژه آماده دیپلوی روی VPS است

---

*مستندات تولید شده در 2026-06-12*
*پروژه Novax Price Alert*