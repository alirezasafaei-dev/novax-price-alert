# Deployment Limitations & Solution

**Date**: 2026-06-12

---

## 🚫 چرا دیپلوی خودکار ممکن نیست؟

### محدودیت‌های محیط فعلی:

1. **❌ No sudo access**
   - دستور `sudo apt-get install sshpass` نیاز به password دارد
   - من نمی‌توانم sudo را اجرا کنم بدون پاسخ از کاربر

2. **❌ No pip/sshpass**
   - `pip3` و `sshpass` نصب نیستند
   - بدون sudo نمی‌توانم آن‌ها را نصب کنم

3. **❌ No SSH key authentication**
   - VPS فقط password-based SSH دارد
   - SSH key برای auto-authentication تنظیم نشده است

4. **❌ No paramiko/pyexpect**
   - این کتابخانه‌ها برای password-based SSH automation نیاز دارند
   - بدون pip نمی‌توانم آن‌ها را نصب کنم

---

## ✅ راه حل‌های موجود

### راه حل 1: نصب sshpass (ساده‌ترین)

```bash
# در ترمینال شما (خارج از این محیط)
sudo apt-get update
sudo apt-get install -y sshpass

# سپس اجرا
cd /home/dev13/my-project/sites/secondary/novax-price-alert
./scripts/deploy-vps-only.sh
```

### راه حل 2: SSH Key Setup (بهترین برای long-term)

```bash
# روی سیستم لوکال شما
ssh-keygen -t rsa -b 4096
ssh-copy-id ubuntu@<redacted-vps-host>

# بعد از این، بدون password می‌توانید وصل شوید
./scripts/deploy-vps-only.sh
```

### راه حل 3: Manual SSH Deployment (اکنون قابل انجام)

دستورات آماده از `scripts/DEPLOY_NOW.sh` را اجرا کنید:

```bash
# کپی دستورات از این فایل و اجرای آنها
./scripts/DEPLOY_NOW.sh
```

---

## 📝 راهنمای کامل

برای راهنمای کامل، این فایل را اجرا کنید:

```bash
python3 /home/dev13/my-project/sites/secondary/novax-price-alert/scripts/deploy-plan.py
```

یا مستندات را بخوانید:

- `docs/DEPLOYMENT_GUIDE.md`
- `docs/DEPLOYMENT_ARCHITECTURE.md`

---

## 🎯 توصیه فوری

### سریع‌ترین روش:

1. یک ترمینال جدید باز کنید
2. دستورات زیر را اجرا کنید:

```bash
# SSH به VPS
ssh ubuntu@<redacted-vps-host>
# Password: ArAd@#!23662366

# روی VPS:
cd /home/deploy/novax-price-alert
python3 -m pip install -r requirements.txt
cd mini-app && npm install && npm run build && cd ..
alembic upgrade head
nano .env  # Set TELEGRAM_RELAY_URL= and TELEGRAM_RELAY_SECRET=
pm2 restart all --update-env
pm2 status
```

3. از سیستم لوکال، فایل‌ها را sync کنید:

```bash
cd /home/dev13/my-project/sites/secondary/novax-price-alert
rsync -avz --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='deploy/cloudflare-worker' \
  . \
  ubuntu@<redacted-vps-host>:/home/deploy/novax-price-alert/
```

---

## ✅ وضعیت نهایی

**همه کارهای آماده‌سازی انجام شده است:**
- ✅ کد آماده
- ✅ مستندات کامل
- ✅ اسکریپت‌های دیپلوی آماده (4 گزینه)
- ✅ راهنمای دقیق

**تنها کار باقیمانده:**
- ⏳ اجرای دستورات (SSH، sync، install، restart)

این یک مرحله manual ساده است که با کپی/پیست چند دستور انجام می‌شود.

---

*Deployment Limitations - 2026-06-12*