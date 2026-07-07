# VPS Deployment Guide (PM2 + Nginx, بدون Docker)

دیپلوی کامل پروژه روی VPS خارج از ایران با PM2 و Nginx.
هیچ وابستگی به Docker، Cloudflare یا سرویس خارجی وجود ندارد.

## معماری

```
اینترنت → Nginx (443/80)
              │
              ├── /mini-app/*  →  FastAPI (127.0.0.1:8000)  ← سرو فایل‌های مینی‌اپ
              ├── /api/v1/*    →  FastAPI                    ← API ربات و مینی‌اپ
              ├── /health      →  FastAPI                    ← health check
              └── /webhook     →  FastAPI                    ← وب‌هوک تلگرام

PM2 process manager:
  novax-api     : uvicorn novax_price_alert.api.main:app (port 8000)
  novax-worker  : python -m novax_price_alert.worker_main
```

### دیتابیس‌ها
- **PostgreSQL** → دیتابیس اصلی (کاربران، هشدارها، تاریخچه قیمت، اشتراک‌ها)
- **Redis** → کش قیمت‌ها، صف نوتیفیکیشن، نشست‌ها

### Worker Interval
- فچ قیمت و بررسی هشدارها: هر **۳۶۰۰ ثانیه** (۱ ساعت)
- ارسال نوتیفیکیشن: هر **۱۰ ثانیه**
- قابل تنظیم با `WORKER_INTERVAL_SECONDS`

## راه‌اندازی

### ۱. روی VPS (یک بار)

```bash
# اتصال به VPS
ssh root@your-vps-ip

# متغیرهای مورد نیاز
export DOMAIN=novax.yourdomain.com
export TELEGRAM_BOT_TOKEN= your_bot_token

# اجرای setup
bash /opt/novax-price-alert/scripts/setup-vps.sh
```

اسکریپت به صورت خودکار:
1. نصب Nginx, PostgreSQL, Redis, Node.js, Python
2. نصب uv و PM2
3. ایجاد دیتابیس PostgreSQL
4. تنظیم `.env`
5. نصب وابستگی‌های Python با `uv sync`
6. بیلد مینی‌اپ ری‌اکت با `VITE_NOVAX_API_BASE=` (خودکار از origin تشخیص می‌دهد)
7. دریافت SSL از Let's Encrypt
8. تنظیم Nginx
9. استارت PM2 برای API + Worker
10. اجرای migrationها

### ۲. انتقال پروژه به VPS (اولین بار)

```bash
# از ماشین محلی خود
rsync -avz --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='.wrangler' \
  --exclude='deploy/cloudflare-worker' \
  /home/dev13/my-project/sites/live/novax-price-alert/ \
  root@your-vps-ip:/opt/novax-price-alert/
```

### ۳. بروزرسانی پروژه

```bash
# از ماشین محلی
bash scripts/deploy-vps-only.sh

# یا دستی
rsync ... && ssh deploy@vps "cd /opt/novax-price-alert && uv sync && pm2 restart all"
```

## مدیریت

### PM2

```bash
pm2 status                    # وضعیت همه سرویس‌ها
pm2 logs novax-api            # لاگ API
pm2 logs novax-worker         # لاگ Worker
pm2 restart novax-api         # ریستارت API
pm2 restart novax-worker      # ریستارت Worker
pm2 restart all               # ریستارت همه
pm2 save                      # ذخیره وضعیت برای restart خودکار
```

### Nginx

```bash
nginx -t                      # تست config
systemctl reload nginx        # اعمال تغییرات
systemctl restart nginx       # ریستارت کامل
```

### PostgreSQL

```bash
systemctl status postgresql
# بکاپ
pg_dump -U novax novax_price_alert > /backups/novax-$(date +%Y%m%d).sql
```

### Redis

```bash
systemctl status redis-server
redis-cli ping                # تست اتصال
```

## تنظیم Webhook تلگرام

بعد از setup کامل، webhook را تنظیم کنید:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://DOMAIN/api/v1/bot/webhook"
```

## SSL Renew خودکار

Let's Encrypt به صورت خودکار تمدید می‌شود. برای اطمینان:

```bash
# چک‌کند دستی
certbot renew --dry-run

# لاگ خودکار (cronjob توسط certbot تنظیم می‌شود)
systemctl status certbot.timer
```

## Troubleshooting

### خطای ۵۰۲ در Nginx
```bash
systemctl status nginx
pm2 status
curl http://127.0.0.1:8000/health
```

### Worker Interval اعمال نمی‌شود
مقدار `WORKER_INTERVAL_SECONDS` را در `.env` چک کنید:
```bash
grep WORKER_INTERVAL_SECONDS /opt/novax-price-alert/.env
```

### مینی‌اپ لوپ لودینگ
مینی‌اپ باید با `VITE_NOVAX_API_BASE=` بیلد شود تا از `window.location.origin` استفاده کند:
```bash
cd /opt/novax-price-alert/mini-app
sed -i 's|^VITE_NOVAX_API_BASE=.*|VITE_NOVAX_API_BASE=|' .env
npm run build
```

### خطای اتصال PostgreSQL
```bash
sudo -u postgres psql -c "\du"               # لیست کاربران
sudo -u postgres psql -c "\l"                # لیست دیتابیس‌ها
psql -U novax -d novax_price_alert -h localhost  # تست اتصال
```
