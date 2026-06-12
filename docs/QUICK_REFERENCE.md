# Novax Price Alert - Quick Reference

**VPS**: <redacted-vps-host> | **Domain**: novax.alirezasafeidev.ir

---

## ⚡ دیپلوی فوری

```bash
cd /home/dev13/my-project/sites/secondary/novax-price-alert
./scripts/deploy-to-vps.sh
```

---

## 🤖 تنظیمات BotFather (کپی و پیست)

```
/newbot
NovaX Price Alert Bot
NovaxPriceAlertBot

/setabouttext
📊 Novax Price Alert - ربات هشدار قیمت
• هشدار قیمت کریپتو و طلا/ارز
• هشدار مرحله‌ای با تایید صریح
• داشبورد هوشمند با چارت زنده
/start - شروع | /price - قیمت‌ها | /alert - هشدار
🌐 https://novax.alirezasafeidev.ir

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

---

## 🔍 مشکل GitHub Actions

**علت**: Secret `API_BASE_URL` تنظیم نشده بود

**راه‌حل**: Workflow به‌روزرسانی شد - حالا اگر secret تنظیم نشده باشد skip می‌کند

**اگر می‌خواهید غیرفعال کنید**: GitHub Settings → Actions → General → Disable all workflows

---

## 🚫 قابلیت گروه/کانال

**وضعیت فعلی**: بات فعلاً فقط private chat را پشتیبانی می‌کند

**برای اضافه کردن**: نیاز به توسعه کد است (feature enhancement)

---

## 📚 مستندات کامل

- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/BOTFATHER_SETUP.md" />
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/DEPLOYMENT_GUIDE.md" />
- <ref_file file="/home/dev13/my-project/sites/secondary/novax-price-alert/docs/FINAL_WORK_SUMMARY.md" />

---

*سریع مرجع - 2026-06-12*