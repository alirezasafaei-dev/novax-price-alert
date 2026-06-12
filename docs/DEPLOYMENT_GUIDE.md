# راهنمای دیپلوی Novax Price Alert روی VPS

**VPS**: <redacted-vps-host>
**Domain**: novax.alirezasafeidev.ir
**Status**: آماده برای دیپلوی نهایی

---

## 🚀 روش 1: استفاده از اسکریپت خودکار (توصیه شده)

### پیش‌نیازها

```bash
# روی سیستم لوکال
sudo apt-get install sshpass rsync
```

### اجرای دیپلوی

```bash
cd /home/dev13/my-project/sites/secondary/novax-price-alert
./scripts/deploy-to-vps.sh
```

این اسکریپت به‌طور خودکار:
- ✅ اتصال به VPS را تست می‌کند
- ✅ فایل‌های پروژه را sync می‌کند
- ✅ Dependencies را نصب/به‌روزرسانی می‌کند
- ✅ Database migrations را اجرا می‌کند
- ✅ PM2 services را restart می‌کند
- ✅ Health check انجام می‌دهد
- ✅ PM2 status را نمایش می‌دهد

---

## 🚀 روش 2: دیپلوی دستی

### مرحله 1: اتصال به VPS

```bash
ssh ubuntu@<redacted-vps-host>
# Password: ArAd@#!23662366
```

### مرحله 2: Navigate to app directory

```bash
cd /home/deploy/novax-price-alert
```

### مرحله 3: Sync فایل‌ها

از سیستم لوکال:

```bash
rsync -avz --delete \
  -e "ssh -p 22 -o StrictHostKeyChecking=no" \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  . \
  ubuntu@<redacted-vps-host>:/home/deploy/novax-price-alert/
```

### مرحله 4: Install dependencies

روی VPS:

```bash
cd /home/deploy/novax-price-alert
pip install --upgrade pip
pip install -r requirements.txt
```

### مرحله 5: Database migrations

```bash
cd /home/deploy/novax-price-alert
alembic upgrade head
```

### مرحله 6: Restart PM2

```bash
pm2 restart novax-api --update-env
pm2 restart novax-worker --update-env
pm2 restart novax-mini-app --update-env
```

### مرحله 7: Check status

```bash
pm2 status
pm2 logs novax-api
```

---

## 🔧 Environment Configuration

### فایل .env روی VPS

فایل `.env` باید این مقادیر را داشته باشد:

```bash
# Bot Token
TELEGRAM_BOT_TOKEN=<redacted-telegram-bot-token>

# Relay
TELEGRAM_RELAY_URL=https://novax-telegram-relay.asdevelooper.workers.dev
TELEGRAM_RELAY_SECRET=YOUR_RELAY_SECRET_HERE

# Cloudflare KV
CLOUDFLARE_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_API_TOKEN
ALERTS_KV_NAME=novax_alerts_kv
ALERTS_KV_ID=YOUR_ALERTS_KV_ID
TELEGRAM_SECRET_TOKEN=YOUR_TELEGRAM_SECRET_TOKEN

# Database (Neon - or local PostgreSQL)
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST/DATABASE?sslmode=require

# Redis (if using local Redis)
REDIS_URL=redis://localhost:6379/0

# API Configuration
API_HOST=0.0.0.0
API_PORT=8001
APP_URL=https://novax.alirezasafeidev.ir

# Gemini API (optional - for AI features)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

---

## 🌐 Nginx Configuration

### Nginx config برای novax.alirezasafeidev.ir

روی VPS:

```bash
sudo nano /etc/nginx/sites-available/novax.alirezasafeidev.ir
```

محتوا:

```nginx
server {
    listen 80;
    server_name novax.alirezasafeidev.ir www.novax.alirezasafeidev.ir;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8001/health;
        proxy_set_header Host $host;
    }

    location /api {
        proxy_pass http://127.0.0.1:8001/api;
        proxy_set_header Host $host;
    }

    location /metrics {
        proxy_pass http://127.0.0.1:8001/metrics;
        proxy_set_header Host $host;
    }
}

server {
    listen 443 ssl http2;
    server_name novax.alirezasafeidev.ir www.novax.alirezasafeidev.ir;

    ssl_certificate /etc/letsencrypt/live/novax.alirezasafeidev.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/novax.alirezasafeidev.ir/privkey.pem;

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8001/health;
        proxy_set_header Host $host;
    }

    location /api {
        proxy_pass http://127.0.0.1:8001/api;
        proxy_set_header Host $host;
    }

    location /metrics {
        proxy_pass http://127.0.0.1:8001/metrics;
        proxy_set_header Host $host;
    }
}
```

فعال کردن config:

```bash
sudo ln -s /etc/nginx/sites-available/novax.alirezasafeidev.ir /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 SSL Certificate با Let's Encrypt

```bash
sudo certbot --nginx -d novax.alirezasafeidev.ir -d www.novax.alirezasafeidev.ir
```

---

## 🏥 Health Check بعد از دیپلوی

### تست Endpoints

```bash
# از روی VPS
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/api/v1/prices/latest
curl http://127.0.0.1:8001/status

# از روی سیستم لوکال
curl https://novax.alirezasafeidev.ir/health
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest
```

### تست بات تلگرام

1. به تلگرام بروید
2. پیدا کنید @NovaxPriceAlertBot
3. `/start` را بزنید
4. `/price` را تست کنید
5. سعی کنید یک alert ایجاد کنید

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# روی VPS
pm2 status
pm2 logs novax-api
pm2 logs novax-worker
pm2 logs novax-mini-app

# Monitor in real-time
pm2 monit
```

### PM2 Setup (اگر انجام نشده)

```bash
cd /home/deploy/novax-price-alert
pm2 start python -m novax_price_alert.api.main --name novax-api
pm2 start python -m novax_price_alert.worker_main --name novax-worker
pm2 start node --name novax-mini-app -- mini-app/server.cjs
pm2 save
pm2 startup
```

---

## 🚨 Troubleshooting

### Bot response نمی‌دهد

```bash
# Check API status
curl http://127.0.0.1:8001/health

# Check logs
pm2 logs novax-api

# Restart service
pm2 restart novax-api
```

### Database connection error

```bash
# Check DATABASE_URL در .env
cat .env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### Worker errors

```bash
# Check worker logs
pm2 logs novax-worker

# Restart worker
pm2 restart novax-worker
```

---

## 📋 چک‌لیست نهایی قبل از دیپلوی

### روی سیستم لوکال:
- [ ] تغییرات commit شده
- [ ] اسکریپت deploy-to-vps.sh قابل اجراست
- [ ] sshpass نصب شده

### روی VPS:
- [ ] اتصال با VPS برقرار است
- [ ] دایرکتوری `/home/deploy/novax-price-alert` وجود دارد
- [ ] Python و pip نصب شده
- [ ] PostgreSQL یا Neon connection works
- [ ] Redis (اگر استفاده می‌شود) running است
- [ ] PM2 نصب شده
- [ ] Nginx نصب شده

### BotFather:
- [ ] Bot ایجاد شده
- [ ] API Token در .env تنظیم شده
- [ ] About text تنظیم شده
- [ ] Commands تنظیم شده
- [ ] Privacy mode Disable شده
- [ ] Inline mode Enable شده

---

## ✅ بعد از دیپلوی موفق

1. **Test Bot**: @NovaxPriceAlertBot را در تلگرام تست کنید
2. **Test API**: https://novax.alirezasafeidev.ir/health
3. **Check Logs**: `pm2 logs novax-api`
4. **Monitor Performance**: استفاده از `/metrics` endpoint
5. **Test Alerts**: یک alert ایجاد کنید و تریگر آن را تست کنید

---

## 🎯 دستورات مفید VPS

```bash
# SSH connection
ssh ubuntu@<redacted-vps-host>

# Navigate to app
cd /home/deploy/novax-price-alert

# Check PM2 status
pm2 status

# View logs
pm2 logs novax-api --lines 50
pm2 logs novax-worker --lines 50

# Restart services
pm2 restart all

# Update code
cd /home/deploy/novax-price-alert
git pull
pip install -r requirements.txt
pm2 restart all

# Database migration
alembic upgrade head

# Nginx reload
sudo nginx -t
sudo systemctl reload nginx

# Check disk space
df -h

# Check memory
free -h

# Check processes
top
```

---

## 📞 Contact در صورت مشکل

اگر دیپلوی با مشکل مواجه شد:
1. Check logs: `pm2 logs`
2. Check health endpoint: `curl http://127.0.0.1:8001/health`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Check system logs: `sudo journalctl -xe`

---

*دیپلوی guide تولید شده در 2026-06-12*
*VPS: <redacted-vps-host>*
*Domain: novax.alirezasafeidev.ir*