# راهنمای استقرار روی VPS ایرانی

## معرفی

این راهنما مهاجرت کامل پروژه Novax Price Alert به VPS ایرانی را توضیح می‌دهد. این راهکار برای محدودیت‌های تحریم و عدم دسترسی به سرویس‌های خارجی طراحی شده است.

## معماری پیشنهادی

```
┌─────────────────────────────────────────────────────────────┐
│                         VPS ایرانی                           │
│  (آروان، دراک، هاست ایران، یا هر VPS ایرانی)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Nginx      │  │  PostgreSQL  │  │    Redis     │      │
│  │   (SSL)      │  │   :5432      │  │    :6379     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                   ┌───────▼────────┐                        │
│                   │  FastAPI App   │                        │
│                   │   :8000        │                        │
│                   │  + Worker      │                        │
│                   └────────────────┘                        │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            │ HTTP Webhook
                            │
                    ┌───────▼────────┐
                    │  Telegram API │
                    │  (Direct)     │
                    └────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions (Price Fetcher)                  │
│  (فچ قیمت از APIهای خارجی بدون محدودیت IP)                  │
└─────────────────────────────────────────────────────────────┘
```

## مزایای این معماری

1. **بدون نیاز به پرداخت خارجی** - همه سرویس‌ها در ایران
2. **فچ قیمت بدون محدودیت IP** - GitHub Actions به عنوان پراکسی
3. **پایداری بالا** - همه اجزا روی یک VPS
4. **نگهداری ساده** - Docker Compose برای مدیریت
5. **هزینه کم** - VPS ایرانی ارزان است

## ساختار پوشه پروژه

```
/opt/novax-price-alert/
├── docker-compose.ir-vps.yml
├── nginx.ir-vps.conf
├── Dockerfile.ir-vps
├── .env.production
├── src/
│   └── novax_price_alert/    # کد اصلی پروژه
├── migrations/
│   └── versions/
├── alembic.ini
├── pyproject.toml
├── scripts/
│   ├── fetch_prices_to_vps.py
│   ├── setup-ir-vps.sh
│   ├── backup-db.sh
│   └── restore-db.sh
├── .github/workflows/
│   └── price-fetcher.yml
├── logs/
│   ├── api.log
│   └── worker.log
├── certs/
│   ├── fullchain.pem
│   └── privkey.pem
└── backups/
```

## راهنمای نصب قدم به قدم

### پیش‌نیازها

- VPS ایرانی با حداقل 2GB RAM و 20GB Storage
- دامنه .ir (یا هر دامنه‌ای که DNS آن را کنترل کنید)
- دسترسی root یا sudo روی VPS
- Telegram Bot Token از @BotFather

### مراحل نصب

#### 1. آماده‌سازی VPS

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin -y

# Install required tools
sudo apt-get install -y git curl openssl certbot python3-certbot-nginx
```

#### 2. آماده‌سازی پروژه

```bash
# Create project directory
sudo mkdir -p /opt/novax-price-alert
sudo chown $USER:$USER /opt/novax-price-alert
cd /opt/novax-price-alert

# Clone repository or copy files
git clone https://github.com/yourusername/novax-price-alert.git .
# یا فایل‌ها را دستی کپی کنید

# Create directories
mkdir -p logs backups certs
```

#### 3. تنظیم متغیرهای محیطی

```bash
# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
METRICS_TOKEN=$(openssl rand -base64 32)

# Create .env.production file
cat > .env.production << EOF
# Database
POSTGRES_USER=novax
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=novax_price_alert

# Redis
REDIS_URL=redis://redis:6379/0

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.ir/api/v1/bot/webhook

# Security
METRICS_ACCESS_TOKEN=${METRICS_TOKEN}

# Environment
ENVIRONMENT=production
DEBUG=false

# Application
ALLOWED_HOSTS=your-domain.ir
USE_MOCK_PROVIDER=false
USE_MOCK_NOTIFICATIONS=false

# Optional APIs
NERKH_API_KEY=
EOF
```

**مهم:** پسورد‌های تولید شده را در جایی امن ذخیره کنید!

#### 4. تنظیم دامنه و DNS

```bash
# DNS records should point to your VPS IP:
# A    your-domain.ir          → VPS_IP
# A    www.your-domain.ir      → VPS_IP
```

#### 5. دریافت SSL Certificate

```bash
# Set your domain and email
DOMAIN="your-domain.ir"
EMAIL="admin@your-domain.ir"

# Update nginx config with your domain
sed -i "s/your-domain.ir/${DOMAIN}/g" nginx.ir-vps.conf
cp nginx.ir-vps.conf nginx.conf

# Start nginx temporarily for certbot
docker compose -f docker-compose.ir-vps.yml up -d nginx

# Obtain SSL certificate
sudo certbot certonly --nginx --agree-tos --email ${EMAIL} -d ${DOMAIN} -d www.${DOMAIN}

# Copy certificates
sudo cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem certs/
sudo cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem certs/
sudo chown $USER:$USER certs/*

# Stop nginx
docker compose -f docker-compose.ir-vps.yml down
```

#### 6. ساخت و اجرای سرویس‌ها

```bash
# Build and start services
docker compose -f docker-compose.ir-vps.yml build
docker compose -f docker-compose.ir-vps.yml up -d

# Wait for services to be ready
sleep 30
```

#### 7. اجرای Migrationها و Seed Data

```bash
# Run migrations
docker compose -f docker-compose.ir-vps.yml exec api uv run alembic upgrade head

# Seed initial data
docker compose -f docker-compose.ir-vps.yml exec api uv run python -m novax_price_alert.scripts.seed_mvp
```

#### 8. بررسی deployment

```bash
# Health checks
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/prices/latest
curl https://your-domain.ir/health
curl https://your-domain.ir/api/v1/prices/latest
```

#### 9. تنظیم GitHub Actions برای Price Fetching

در GitHub repository:

1. **Secrets تنظیم کنید:**
   - `VPS_API_URL`: `https://your-domain.ir`
   - `VPS_API_TOKEN`: METRICS_TOKEN که در مرحله 3 تولید کردید

2. **فایل `.github/workflows/price-fetcher.yml`** را فعال کنید

3. **Workflow را دستی اجرا کنید** برای تست:

```bash
# در GitHub: Actions tab → Price Fetcher → Run workflow
```

#### 10. استفاده از اسکریپت خودکار

برای راحتی، از اسکریپت آماده استفاده کنید:

```bash
# Set environment variables
export DOMAIN="your-domain.ir"
export EMAIL="admin@your-domain.ir"
export TELEGRAM_BOT_TOKEN="your_bot_token"

# Run setup script
chmod +x scripts/setup-ir-vps.sh
./scripts/setup-ir-vps.sh
```

## تنظیم Webhook تلگرام

پس از استقرار موفق، webhook تلگرام را تنظیم کنید:

```bash
# Set webhook to point to your VPS
TELEGRAM_BOT_TOKEN="your_bot_token"
WEBHOOK_URL="https://your-domain.ir/api/v1/bot/webhook"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"edited_message\"]}"
```

برای بررسی webhook:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## مدیریت و نگهداری

### بکاپ‌گیری خودکار

```bash
# Create backup script
cat > scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/novax-price-alert/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/novax_backup_${TIMESTAMP}.sql"

# Backup database
docker compose -f docker-compose.ir-vps.yml exec -T postgres pg_dump -U novax novax_price_alert > ${BACKUP_FILE}

# Compress
gzip ${BACKUP_FILE}

# Keep only last 7 days
find ${BACKUP_DIR} -name "novax_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
EOF

chmod +x scripts/backup-db.sh

# Add to crontab for daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/novax-price-alert/scripts/backup-db.sh") | crontab -
```

### لاگ‌ها و مانیتورینگ

```bash
# View logs
docker compose -f docker-compose.ir-vps.yml logs -f api
docker compose -f docker-compose.ir-vps.yml logs -f worker
docker compose -f docker-compose.ir-vps.yml logs -f nginx

# Check service status
docker compose -f docker-compose.ir-vps.yml ps
```

### ریستارت سرویس‌ها

```bash
# Restart all services
docker compose -f docker-compose.ir-vps.yml restart

# Restart specific service
docker compose -f docker-compose.ir-vps.yml restart api
docker compose -f docker-compose.ir-vps.yml restart worker
```

## نکات امنیتی برای محیط ایرانی

### 1. فایروال

```bash
# Install and configure UFW
sudo apt-get install ufw -y

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 2. امنیت دیتابیس

```bash
# PostgreSQL only accessible from localhost
# Already configured in docker-compose.yml with "127.0.0.1:5432:5432"

# Redis only accessible from localhost
# Already configured in docker-compose.yml with "127.0.0.1:6379:6379"
```

### 3. مدیریت Secrets

- هیچ وقت secrets را در git commit نکنید
- از environment variables استفاده کنید
- برای production، از secrets management tools مثل HashiCorp Vault استفاده کنید (در صورت امکان)

### 4. SSL و HTTPS

- گواهی SSL را هر 90 روز renewal کنید (Let's Encrypt)
- تنظیم auto-renewal:

```bash
# Add auto-renewal to crontab
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/novax-price-alert/docker-compose.ir-vps.yml restart nginx") | crontab -
```

### 5. محدود کردن دسترسی API

```bash
# در nginx.conf، rate limiting تنظیم شده است
# برای محدودیت بیشتر، می‌توانید IP whitelist اضافه کنید

# مثال: فقط اجازه دسترسی به IPهای خاص برای /metrics
location /metrics {
    allow 1.2.3.4;  # آدرس IP مدیریتی شما
    deny all;
    
    proxy_pass http://fastapi_backend;
    # ... rest of config
}
```

## بهینه‌سازی برای محیط ایرانی

### 1. استفاده از APIهای ایرانی

در صورت امکان، از APIهای ایرانی استفاده کنید تا وابستگی به سرویس‌های خارجی کمتر شود:

- **نوبیتکس**: `https://api.nobitex.ir` - قیمت کریپتو
- **رامین‌کریپتو**: APIهای کریپتو ایرانی
- **TGJU**: `https://www.tgju.org` - قیمت طلا و ارز

### 2. Cache Strategy

با توجه به سرعت اینترنت در ایران، cache агgresive استفاده کنید:

```python
# در application settings
CACHE_TTL_SECONDS = 300  # 5 minutes
```

### 3. CDN (در صورت نیاز)

اگر کاربران زیادی دارید، می‌توانید از CDN ایرانی استفاده کنید:

- **آروان CDN**
- **پارس‌پک CDN**
- **های‌وب CDN**

## حل مشکلات رایج

### مشکل: Docker container نمی‌تواند به اینترنت دسترسی پیدا کند

```bash
# Check DNS
docker compose -f docker-compose.ir-vps.yml exec api cat /etc/resolv.conf

# اگر مشکل بود، DNS را در docker-compose.yml تنظیم کنید:
dns:
  - 8.8.8.8
  - 8.8.4.4
```

### مشکل: SSL Certificate error

```bash
# Check certificate expiration
sudo certbot certificates

# Renew manually
sudo certbot renew

# Restart nginx
docker compose -f docker-compose.ir-vps.yml restart nginx
```

### مشکل: GitHub Actions نمی‌تواند به VPS وصل شود

```bash
# Check VPS firewall - port 443 باید باز باشد
sudo ufw status

# Check if VPS is accessible from internet
curl https://your-domain.ir/health
```

### مشکل: Price fetcher کار نمی‌کند

```bash
# در GitHub Actions، logs را بررسی کنید
# در VPS، logs را چک کنید:

docker compose -f docker-compose.ir-vps.yml logs api | grep ingest

# Endpoint را تست کنید:
curl -X POST https://your-domain.ir/api/v1/prices/ingest \
  -H "Authorization: Bearer YOUR_METRICS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": []}'
```

## ارتقاء و به‌روزرسانی

```bash
# Pull latest code
cd /opt/novax-price-alert
git pull origin main

# Rebuild services
docker compose -f docker-compose.ir-vps.yml build
docker compose -f docker-compose.ir-vps.yml up -d

# Run migrations
docker compose -f docker-compose.ir-vps.yml exec api uv run alembic upgrade head

# Restart services
docker compose -f docker-compose.ir-vps.yml restart
```

## هزینه‌های تقریبی

- **VPS ایرانی (2GB RAM، 20GB Storage)**: ~100,000 - 200,000 تومان/month
- **دامنه .ir**: ~100,000 تومان/year
- **GitHub Actions**: رایگان
- **مجمجموع**: ~1,500,000 - 2,500,000 تومان/year

## مقایسه با گزینه‌های دیگر

| گزینه | هزینه ایرانی | پیچیدگی | پایداری |
|-------|--------------|---------|---------|
| **VPS ایرانی** | کم | متوسط | بالا |
| Cloudflare + Render | صفر (تحریم) | پایین | متوسط |
| Serv00.com | رایگان | بالا | متوسط |
| Heroku/Vercel | غیرممکن (تحریم) | - | - |

## منابع و پشتیبانی

- **اسناد اصلی**: `docs/ARCHITECTURE.md`, `docs/API.md`
- **Deployment VPS**: `docs/DEPLOYMENT.md`
- **Cloudflare + Render**: `docs/CLOUDFLARE_RENDER_DEPLOYMENT.md`

## جمع‌بندی

این راهکار به شما اجازه می‌دهد:
1. بدون پرداخت خارجی، سرویس را اجرا کنید
2. با محدودیت‌های IP ایرانی مقابله کنید
3. پایداری بالا داشته باشید
4. هزینه کم نگهداری

ساختار طراحی شده ساده، مقیاس‌پذیر و نگهداری آسان است.
```