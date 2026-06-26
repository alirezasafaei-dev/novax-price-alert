# راهنمای کامل Deployment خودکار برای Agent

**هدف**: این راهنما برای agent طراحی شده تا بتواند بدون سوال، کامل پروژه Novax Price Alert را deploy کند.

**معماری هدف**: Hybrid (VPS + Cloudflare Worker)

---

## 📋 پیش‌نیازها و محیط‌ها

### 1. محیط‌های لازم:

#### A. VPS ایرانی (<redacted-vps-host>)
- Ubuntu 22.04+
- SSH key access (بدون password)
- user: `ubuntu`

#### B. Cloudflare Account
- Account ID
- API Token
- Worker برای Telegram relay

#### C. GitHub Repository
- Secrets برای GitHub Actions
- Repository: `alirezasafaei-dev/novax-price-alert`

#### D. Telegram Bot
- Bot Token (@novax_price_bot - 8858674032)
- Webhook URL
- BotFather configuration

#### E. External Services (اختیاری)
- PostgreSQL (Neon یا local)
- Redis (local یا cloud)
- Database migration tool (Alembic)

---

## 🔑 لیست کامل Environment Variables

### VPS Environment Variables (/home/ubuntu/novax-price-alert/.env):

```bash
# Database
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require

# Telegram Bot
TELEGRAM_BOT_TOKEN=<redacted-telegram-bot-token>
TELEGRAM_RELAY_URL=https://novax-telegram-relay.asdevelooper.workers.dev
TELEGRAM_RELAY_SECRET=YOUR_SECRET_HERE

# API Configuration
API_HOST=0.0.0.0
API_PORT=8001
APP_URL=https://novax.alirezasafeidev.ir

# Admin/Security
ADMIN_ACCESS_TOKEN=YOUR_ADMIN_TOKEN
METRICS_ACCESS_TOKEN=YOUR_METRICS_TOKEN
INGEST_API_TOKEN=YOUR_INGEST_TOKEN

# Price Providers (Optional)
BINANCE_API_KEY=YOUR_BINANCE_KEY
BINANCE_API_SECRET=YOUR_BINANCE_SECRET

# Monitoring (Optional)
SENTRY_DSN=YOUR_SENTRY_DSN
```

### GitHub Secrets (Settings > Secrets > Actions):

```bash
API_BASE_URL=https://novax.alirezasafeidev.ir
OPS_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
OPS_CHAT_ID=YOUR_OPS_CHAT_ID (private chat, NOT group)
INGEST_API_TOKEN=YOUR_INGEST_TOKEN
ADMIN_ACCESS_TOKEN=YOUR_ADMIN_TOKEN
```

### Cloudflare Worker Secrets:

```bash
TELEGRAM_BOT_TOKEN=<redacted-telegram-bot-token>
TELEGRAM_SECRET_TOKEN=YOUR_SECRET_TOKEN
ALERTS_KV=YOUR_KV_NAMESPACE
SESSIONS_KV=YOUR_SESSIONS_KV_NAMESPACE
USERS_KV=YOUR_USERS_KV_NAMESPACE
```

---

## 🚀 مراحل Deployment خودکار (برای Agent)

### مرحله 1: آماده‌سازی VPS

```bash
# 1.1: SSH به VPS
ssh ubuntu@<redacted-vps-host>

# 1.2: بررسی و نصب پیش‌نیازها
sudo apt update
sudo apt install -y python3 python3-pip nodejs npm postgresql-client nginx certbot

# 1.3: نصuv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

# 1.4: ساخت دایرکتوری پروژه
sudo mkdir -p /home/ubuntu/novax-price-alert
sudo chown ubuntu:ubuntu /home/ubuntu/novax-price-alert
cd /home/ubuntu/novax-price-alert

# 1.5: Clone repository
git clone https://github.com/alirezasafaei-dev/novax-price-alert.git .
git checkout main

# 1.6: ساخت environment file
cat > .env << 'EOF'
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_RELAY_URL=https://novax-telegram-relay.asdevelooper.workers.dev
TELEGRAM_RELAY_SECRET=YOUR_SECRET
API_HOST=0.0.0.0
API_PORT=8001
APP_URL=https://novax.alirezasafeidev.ir
ADMIN_ACCESS_TOKEN=YOUR_ADMIN_TOKEN
METRICS_ACCESS_TOKEN=YOUR_METRICS_TOKEN
INGEST_API_TOKEN=YOUR_INGEST_TOKEN
EOF

# 1.7: محدودیت دسترسی فایل .env
chmod 600 .env
```

### مرحله 2: نصب Dependencies

```bash
# 2.1: Python dependencies
uv sync

# 2.2: Mini-app dependencies
cd deploy/cloudflare-worker
npm ci
cd ../..

# 2.3: ساخت mini-app
cd deploy/cloudflare-worker
npm run build
cd ../..
```

### مرحله 3: Database Setup

```bash
# 3.1: ایجاد PostgreSQL database (اگر local)
sudo -u postgres psql << 'EOF'
CREATE DATABASE novax_price_alert;
CREATE USER novax_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE novax_price_alert TO novax_user;
\q
EOF

# 3.2: یا اتصال به Neon/external database
# .env را با DATABASE_URL مناسب تنظیم کنید

# 3.3: Run database migrations
uv run alembic upgrade head

# 3.4: Seed initial assets
uv run python -m novax_price_alert.cli.seed_assets
```

### مرحله 4: نصب و پیکربندی Redis (اختیاری)

```bash
# 4.1: نصب Redis
sudo apt install -y redis-server

# 4.2: فعال‌سازی Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 4.3: بررسی وضعیت
sudo systemctl status redis-server
```

### مرحله 5: پیکربندی Nginx

```bash
# 5.1: ساخت Nginx config
sudo cat > /etc/nginx/sites-available/novax-price-alert << 'EOF'
server {
    listen 80;
    server_name novax.alirezasafeidev.ir;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8001/health;
        access_log off;
    }
}
EOF

# 5.2: فعال‌سازی site
sudo ln -s /etc/nginx/sites-available/novax-price-alert /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### مرحله 6: پیکربندی SSL (Let's Encrypt)

```bash
# 6.1: دریافت SSL certificate
sudo certbot --nginx -d novax.alirezasafeidev.ir --non-interactive --agree-tos --email your@email.com

# 6.2: بررسی SSL
curl -I https://novax.alirezasafeidev.ir
```

### مرحله 7: ساخت Systemd Services

```bash
# 7.1: Systemd service برای API
sudo cat > /etc/systemd/system/novax-price-alert-api.service << 'EOF'
[Unit]
Description=Novax Price Alert API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/novax-price-alert
Environment="PATH=/home/ubuntu/.local/bin:/usr/bin"
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn novax_price_alert.api.main:create_app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 7.2: Systemd service برای Worker
sudo cat > /etc/systemd/system/novax-price-alert-worker.service << 'EOF'
[Unit]
Description=Novax Price Alert Worker
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/novax-price-alert
Environment="PATH=/home/ubuntu/.local/bin:/usr/bin"
ExecStart=/home/ubuntu/.local/bin/uv run python -m novax_price_alert.worker.cron_worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 7.3: Systemd service برای Mini-App (اگر جداگانه serve شود)
sudo cat > /etc/systemd/system/novax-mini-app.service << 'EOF'
[Unit]
Description=Novax Mini-App Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/novax-price-alert/deploy/cloudflare-worker
Environment="PATH=/home/ubuntu/.local/bin:/usr/bin"
ExecStart=npx serve dist -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 7.4: فعال‌سازی services
sudo systemctl daemon-reload
sudo systemctl enable novax-price-alert-api
sudo systemctl enable novax-price-alert-worker
sudo systemctl enable novax-mini-app
```

### مرحله 8: شروع سرویس‌ها

```bash
# 8.1: شروع سرویس‌ها
sudo systemctl start novax-price-alert-api
sudo systemctl start novax-price-alert-worker
sudo systemctl start novax-mini-app

# 8.2: بررسی وضعیت
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app

# 8.3: مشاهده logs (در صورت مشکل)
sudo journalctl -u novax-price-alert-api -n 50
sudo journalctl -u novax-price-alert-worker -n 50
```

### مرحله 9: پیکربندی Cloudflare Worker

```bash
# 9.1: به دایرکتوری worker بروید
cd /home/ubuntu/novax-price-alert/deploy/cloudflare-worker

# 9.2: ساخت wrangler.toml
cat > wrangler.toml << 'EOF'
name = "novax-telegram-relay"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "ALERTS_KV"
id = "YOUR_KV_ID"
preview_id = "YOUR_KV_ID"

[[env.production.kv_namespaces]]
binding = "SESSIONS_KV"
id = "YOUR_SESSIONS_KV_ID"
preview_id = "YOUR_SESSIONS_KV_ID"

[[env.production.kv_namespaces]]
binding = "USERS_KV"
id = "YOUR_USERS_KV_ID"
preview_id = "YOUR_USERS_KV_ID"

[triggers]
crons = ["*/10 * * * *"]
EOF

# 9.3: Deploy worker
npm install -g wrangler
wrangler login
wrangler deploy

# 9.4: تنظیم secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_SECRET_TOKEN
```

### مرحله 10: پیکربندی Telegram Webhook

```bash
# 10.1: تنظیم webhook به Cloudflare Worker
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://novax-telegram-relay.asdevelooper.workers.dev/webhook",
    "allowed_updates": ["message", "callback_query"]
  }'

# 10.2: بررسی webhook
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### مرحله 11: پیکربندی GitHub Actions (Optional)

```bash
# 11.1: در GitHub repo، به Settings > Secrets > Actions بروید
# 11.2: secrets زیر را اضافه کنید:
# API_BASE_URL=https://novax.alirezasafeidev.ir
# OPS_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
# OPS_CHAT_ID=YOUR_OPS_CHAT_ID
# INGEST_API_TOKEN=YOUR_INGEST_TOKEN
# ADMIN_ACCESS_TOKEN=YOUR_ADMIN_TOKEN
```

### مرحله 12: Health Checks و Verification

```bash
# 12.1: Health check
curl https://novax.alirezasafeidev.ir/health

# 12.2: Prices API
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest

# 12.3: TWA
curl https://novax.alirezasafeidev.ir/

# 12.4: Cloudflare Worker health
curl https://novax-telegram-relay.asdevelooper.workers.dev/health

# 12.5: SSL check
curl -I https://novax.alirezasafeidev.ir
```

### مرحله 13: تست Bot

```bash
# 13.1: در Telegram، bot را پیدا کنید: @novax_price_bot
# 13.2: /start را ارسال کنید
# 13.3: /price را تست کنید
# 13.4: ساخت هشدار تست کنید
# 13.5: TWA را باز کنید (دکمه وب‌اپ)
```

---

## 🔄 مراحل بروزرسانی (Update Deployment)

### برای هر commit جدید:

```bash
# 1. SSH به VPS
ssh ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert

# 2. Pull latest changes
git pull origin main

# 3. Install new dependencies
uv sync
cd deploy/cloudflare-worker
npm ci
npm run build
cd ../..

# 4. Run database migrations
uv run alembic upgrade head

# 5. Restart services
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app

# 6. Health check
curl https://novax.alirezasafeidev.ir/health
```

### برای Cloudflare Worker update:

```bash
cd /home/ubuntu/novax-price-alert/deploy/cloudflare-worker
wrangler deploy
```

---

## 🔍 Troubleshooting Guide

### مشکل: Service نمی‌آید

```bash
# Check logs
sudo journalctl -u novax-price-alert-api -f
sudo journalctl -u novax-price-alert-worker -f

# Check if port is in use
sudo lsof -i :8001

# Check .env file
cat /home/ubuntu/novax-price-alert/.env

# Check dependencies
uv sync
```

### مشکل: Database connection error

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL

# Check database exists
sudo -u postgres psql -l
```

### مشکل: Webhook کار نمی‌کند

```bash
# Check webhook info
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

# Check worker health
curl https://novax-telegram-relay.asdevelooper.workers.dev/health

# Reset webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

### مشکل: SSL certificate

```bash
# Renew certificate
sudo certbot renew

# Force renew
sudo certbot renew --force-renewal

# Check SSL
openssl s_client -connect novax.alirezasafeidev.ir:443
```

---

## 📊 Checklist نهایی قبل از تحویل

### Pre-Deployment:
- [ ] VPS SSH access verified
- [ ] All environment variables documented
- [ ] Database credentials ready
- [ ] Telegram bot token ready
- [ ] Cloudflare credentials ready
- [ ] GitHub secrets configured

### Post-Deployment:
- [ ] All systemd services running
- [ ] Health endpoint returns 200
- [ ] Prices API returning data
- [ ] TWA loading correctly
- [ ] SSL certificate valid
- [ ] Bot responding to /start
- [ ] Cloudflare Worker healthy
- [ ] Webhook configured
- [ ] Database connected
- [ ] Worker cron jobs running

### Performance:
- [ ] API response time < 500ms
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Error rate < 1%

---

## 🚨 Rollback Procedure

در صورت مشکل بعد از deployment:

```bash
# 1. Rollback code
git log --oneline -5
git checkout <previous-commit-hash>

# 2. Restart services
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app

# 3. Rollback database
uv run alembic downgrade -1

# 4. Check health
curl https://novax.alirezasafeidev.ir/health
```

---

## 📝 Notes مهم برای Agent

1. **همیشه قبل از تغییر، backup بگیرید:**
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Environment variables را هرگز در git commit نکنید**

3. **همیشه بعد از هر تغییر، health check اجرا کنید**

4. **Logs را در صورت مشکل بررسی کنید**

5. **یک‌مرحله یک‌مرحله جلو بروید و هر مرحله را verify کنید**

6. **در صورت خطا، log complete error message را گزارش دهید**

---

## 🎯 خروجی مورد انتظار

پس از کامل شدن این deployment:

- ✅ API در https://novax.alirezasafeidev.ir در دسترس است
- ✅ Health endpoint سالم برمی‌گرداند
- ✅ Prices API قیمت‌های زنده می‌دهد
- ✅ TWA در Telegram کار می‌کند
- ✅ Telegram bot به دستورات پاسخ می‌دهد
- ✅ Alert evaluation هر 10 دقیقه اجرا می‌شود
- ✅ Cloudflare Worker relay کار می‌کند
- ✅ SSL certificate معتبر است
- ✅ همه systemd services در حال اجرا هستند

---

*این راهنما برای agent طراحی شده تا بدون سوال، کامل deployment را انجام دهد.*
