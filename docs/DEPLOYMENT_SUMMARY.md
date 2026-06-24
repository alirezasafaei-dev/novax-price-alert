# Novax Price Alert - Deployment Summary

**Date**: 2026-06-12
**VPS**: <redacted-vps-host>
**Domain**: novax.alirezasafeidev.ir
**Bot ID**: 8858674032
**Username**: @novax_price_bot

---

## ✅ کارهای انجام شده

### 1. معماری دیپلوی تحلیل شد
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/DEPLOYMENT_ARCHITECTURE.md" />
- Cloudflare Worker: فقط برای relay پیام‌های تلگرام (اختیاری)
- VPS: سیستم اصلی (Python/FastAPI + PostgreSQL + Redis + PM2)

### 2. استراتژی دیپلوی مشخص شد
- **حالت پیشنهادی**: VPS-only (بدون Cloudflare Worker)
- **حالت پیشرفته**: VPS + Cloudflare Worker relay

### 3. اسکریپت‌های دیپلوی آماده شدند
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/scripts/deploy-to-vps.sh" /> (interactive با گزینه انتخاب)
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/scripts/deploy-vps-only.sh" /> (ساده، خودکار، VPS-only)

---

## 🚀 دیپلوی فوری (ساده‌ترین و پیشنهادی)

### دستور اجرا:

```bash
cd /home/dev13/my-project/sites/secondary/novax-price-alert
./scripts/deploy-vps-only.sh
```

این اسکریپت:
- ✅ به VPS وصل می‌شود
- ✅ فایل‌ها را sync می‌کند
- ✅ Python dependencies را نصب می‌کند
- ✅ Mini-app را build می‌کند
- ✅ Database migrations را اجرا می‌کند
- ✅ .env را برای VPS-only تنظیم می‌کند (relay غیرفعال)
- ✅ PM2 services را restart می‌کند
- ✅ Health checks انجام می‌دهد

---

## 🎯 معماری دیپلوی

### سیستم VPS (اصلی و کافی):
```
User → Telegram Bot (@novax_price_bot)
         ↓
Telegram API → VPS (Direct Connection)
         ↓
FastAPI (8001) + PostgreSQL + Redis
         ↓
Nginx → novax.alirezasafeidev.ir
```

**چرا VPS-only؟**
- VPS ایرانی است → محدودیت IP حل شده
- ساده‌تر، کمتر complexity
- هزینه کمتر
- کنترل کامل

---

### سیستم Cloudflare Worker (اختیاری):
```
User → Telegram Bot
         ↓
Telegram Webhook → Cloudflare Worker
         ↓ (relay)
VPS API → FastAPI + PostgreSQL + Redis
```

**زمان استفاده از Cloudflare Worker؟**
- اگر به relay نیاز دارید
- اگر از KV storage استفاده می‌کنید
- اگر DDoS protection اضافه می‌خواهید

---

## 📋 پیش‌نیازات

### روی سیستم لوکال:
```bash
sudo apt-get install sshpass rsync
```

### روی VPS (<redacted-vps-host>):
- Python 3.10+
- PostgreSQL
- Redis
- PM2
- Nginx
- SSL Certificate برای novax.alirezasafeidev.ir

---

## 🔧 دستورات مدیریت

### دیپلوی:
```bash
./scripts/deploy-vps-only.sh
```

### VPS Connection:
```bash
ssh ubuntu@<redacted-vps-host>
# Password: <redacted-vps-password>
```

### PM2 Management:
```bash
ssh ubuntu@<redacted-vps-host> "pm2 status"
ssh ubuntu@<redacted-vps-host> "pm2 logs novax-api"
ssh ubuntu@<redacted-vps-host> "pm2 logs novax-worker"
ssh ubuntu@<redacted-vps-host> "pm2 logs novax-mini-app"
```

### Health Checks:
```bash
curl https://novax.alirezasafeidev.ir/health
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest
```

---

## 🤖 BotFather Settings

متن‌های آماده را از <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/BOTFATHER_SETUP.md" /> کپی کنید.

---

## 📚 مستندات کامل

- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/BOTFATHER_SETUP.md" /> - راهنمای BotFather
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/DEPLOYMENT_ARCHITECTURE.md" /> - معماری دیپلوی
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/DEPLOYMENT_GUIDE.md" /> - راهنمای دیپلوی دستی
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/QUICK_REFERENCE.md" /> - مرجع سریع

---

## ✅ وضعیت نهایی

**پروژه Novax Price Alert آماده دیپلوی کامل روی VPS است.**

- ✅ معماری تحلیل شد
- ✅ استراتژی دیپلوی مشخص شد
- ✅ اسکریپت‌های دیپلوی آماده شدند
- ✅ مستندات کامل ایجاد شد
- ✅ Bot ID به‌روزرسانی شد: 8858674032
- ✅ Telegram relay می‌تواند فعال یا غیرفعال شود

**دیپلوی فوری با یک دستور:**
```bash
./scripts/deploy-vps-only.sh
```

---

*Deployment Summary - 2026-06-12*