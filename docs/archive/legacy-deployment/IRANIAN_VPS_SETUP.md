# Iranian VPS Deployment - Complete Setup

## 🇮🇷 راهنمای کامل استقرار روی VPS ایرانی

این راهکار برای اجرای پروژه Novax Price Alert روی VPS ایرانی طراحی شده است تا بدون نیاز به پرداخت خارجی و با دور زدن محدودیت‌های IP، سرویس پایدار داشته باشید.

## 📁 فایل‌های جدید

### کانفیگ Docker
- `docker-compose.ir-vps.yml` - Docker Compose کامل با PostgreSQL, Redis, API, Worker, Nginx
- `Dockerfile.ir-vps` - Dockerfile بهینه برای محیط VPS
- `nginx.ir-vps.conf` - Nginx با SSL, rate limiting, security headers

### اسکریپت‌ها
- `scripts/setup-ir-vps.sh` - اسکریپت نصب خودکار (یک خط!)
- `scripts/fetch_prices_to_vps.py` - Price fetcher برای GitHub Actions
- `scripts/backup-db.sh` - بکاپ‌گیری دیتابیس
- `scripts/restore-db.sh` - بازیابی دیتابیس

### GitHub Actions
- `.github/workflows/price-fetcher.yml` - Workflow هر 5 دقیقه قیمت می‌گیرد

### مستندات
- `docs/IRANIAN_VPS_DEPLOYMENT.md` - راهنمای کامل (500+ lines)
- `docs/IRANIAN_VPS_QUICKSTART.md` - راهنمای سریع

### کد API
- اضافه شده `/api/v1/prices/ingest` endpoint برای دریافت قیمت از GitHub Actions

## 🚀 نصب سریع (3 دقیقه)

```bash
# روی VPS ایرانی
ssh user@your-vps-ip

# نصب Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone و نصب
cd /opt
git clone https://github.com/yourusername/novax-price-alert.git
cd novax-price-alert

# تنظیم متغیرها و اجرای نصب
export DOMAIN="your-domain.ir"
export EMAIL="admin@your-domain.ir"
export TELEGRAM_BOT_TOKEN="your_bot_token"
chmod +x scripts/setup-ir-vps.sh
./scripts/setup-ir-vps.sh
```

اسکریپت نصب همه کارها را انجام می‌دهد:
- ✅ Docker و Docker Compose
- ✅ SSL Certificate با Let's Encrypt
- ✅ PostgreSQL + Redis + API + Worker + Nginx
- ✅ Database migrations
- ✅ Seed data
- ✅ Security settings

## 🔄 معماری

```
GitHub Actions (رایگان) → قیمت از Binance/TGJU/Nobitex
                                     ↓
                            VPS ایرانی (HTTPS)
                                     ↓
┌─────────────────────────────────────────────┐
│  Nginx → FastAPI → PostgreSQL + Redis        │
│  (SSL)   (API)   (Database)  (Cache)        │
└─────────────────────────────────────────────┘
                                     ↓
                            Telegram Webhook
```

## 🔧 تنظیم GitHub Actions

در GitHub repository:

1. **Secrets اضافه کنید:**
   ```
   VPS_API_URL = https://your-domain.ir
   VPS_API_TOKEN = METRICS_TOKEN (از خروجی اسکریپت نصب)
   ```

2. **Workflow را فعال کنید:**
   - Tab Actions → Price Fetcher → Enable workflow
   - یک بار دستی Run workflow کنید

## 📱 تنظیم Webhook تلگرام

```bash
TELEGRAM_BOT_TOKEN="your_token"
WEBHOOK_URL="https://your-domain.ir/api/v1/bot/webhook"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}"
```

## 💰 هزینه تقریبی

| آیتم | هزینه سالانه |
|------|--------------|
| VPS ایرانی (2GB RAM) | ~1,800,000 تومان |
| دامنه .ir | ~100,000 تومان |
| GitHub Actions | رایگان |
| **مجموع** | **~2,000,000 تومان/سال** |

## 🛡️ امنیت

- ✅ SSL/TLS با Let's Encrypt
- ✅ Firewall (UFW) - فقط 80/443
- ✅ Rate limiting در Nginx
- ✅ Database روی localhost فقط
- ✅ Security headers
- ✅ Environment variables برای secrets

## 📊 مدیریت

```bash
# Check status
docker compose -f docker-compose.ir-vps.yml ps

# View logs
docker compose -f docker-compose.ir-vps.yml logs -f

# Backup
./scripts/backup-db.sh

# Restore
./scripts/restore-db.sh backup.sql.gz

# Restart
docker compose -f docker-compose.ir-vps.yml restart
```

## 🔍 Troubleshooting

### Price fetcher کار نمی‌کند
```bash
# در GitHub Actions logs را چک کنید
# در VPS:
curl -X POST https://your-domain.ir/api/v1/prices/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"items": []}'
```

### SSL error
```bash
sudo certbot renew
docker compose -f docker-compose.ir-vps.yml restart nginx
```

### Database connection error
```bash
docker compose -f docker-compose.ir-vps.yml restart postgres
docker compose -f docker-compose.ir-vps.yml logs postgres
```

## 🎯 مزایا

1. **بدون نیاز به پرداخت خارجی** - همه سرویس‌ها در ایران
2. **دور زدن محدودیت IP** - GitHub Actions به عنوان پراکسی
3. **پایداری بالا** - همه اجزا روی یک سرور
4. **هزینه کم** - ~2 میلیون تومان سالانه
5. **نگهداری ساده** - Docker Compose
6. **Security بالا** - SSL, Firewall, Rate limiting

## 📚 مستندات کامل

برای جزئیات کامل:
- `docs/IRANIAN_VPS_DEPLOYMENT.md` - راهنمای 500 خطی با همه جزئیات
- `docs/IRANIAN_VPS_QUICKSTART.md` - راهنمای سریع
- `docs/ARCHITECTURE.md` - معماری سیستم
- `docs/API.md` - API endpoints

## 🆚 مقایسه با گزینه‌های دیگر

| گزینه | هزینه ایرانی | پیچیدگی | پایداری |
|-------|--------------|---------|---------|
| **VPS ایرانی** | 2M تومان/سال | متوسط | ⭐⭐⭐⭐⭐ |
| Cloudflare + Render | صفر (تحریم) | پایین | ⭐⭐⭐ |
| Serv00.com | رایگان | بالا | ⭐⭐⭐ |
| Heroku/Vercel | غیرممکن | - | - |

## 🎉 شروع کنید

```bash
# فقط یک دستور!
./scripts/setup-ir-vps.sh
```

بقیه کارها خودکار است. 🚀