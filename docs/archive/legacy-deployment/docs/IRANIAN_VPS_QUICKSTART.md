# راهنمای سریع VPS ایرانی

این راهنمای سریع برای استقرار سریع روی VPS ایرانی است.

## فایل‌های جدید

برای deployment روی VPS ایرانی، این فایل‌ها اضافه شده‌اند:

### کانفیگ اصلی
- `docker-compose.ir-vps.yml` - Docker Compose برای VPS ایرانی
- `Dockerfile.ir-vps` - Dockerfile بهینه برای VPS
- `nginx.ir-vps.conf` - تنظیمات Nginx با SSL و security

### اسکریپت‌ها
- `scripts/setup-ir-vps.sh` - اسکریپت نصب خودکار
- `scripts/fetch_prices_to_vps.py` - Price fetcher برای GitHub Actions
- `scripts/backup-db.sh` - بکاپ‌گیری دیتابیس
- `scripts/restore-db.sh` - بازیابی دیتابیس

### GitHub Actions
- `.github/workflows/price-fetcher.yml` - Workflow برای فچ قیمت

### مستندات
- `docs/IRANIAN_VPS_DEPLOYMENT.md` - راهنمای کامل deployment

## شروع سریع

### 1. آماده‌سازی VPS

```bash
# روی VPS ایرانی (آروان، دراک، هاست ایران، ...)
ssh user@your-vps-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. تنظیم پروژه

```bash
# Clone repository
cd /opt
git clone https://github.com/yourusername/novax-price-alert.git
cd novax-price-alert

# Set environment variables
export DOMAIN="your-domain.ir"
export EMAIL="admin@your-domain.ir"
export TELEGRAM_BOT_TOKEN="your_bot_token"
```

### 3. اجرای اسکریپت نصب

```bash
chmod +x scripts/setup-ir-vps.sh
./scripts/setup-ir-vps.sh
```

این اسکریپت همه کارها را انجام می‌دهد:
- نصب Docker و Docker Compose
- تنظیم SSL با Let's Encrypt
- ساخت و اجرای سرویس‌ها
- اجرای migrations
- seed data

### 4. تنظیم GitHub Actions

در GitHub repository:

1. Secrets اضافه کنید:
   - `VPS_API_URL`: `https://your-domain.ir`
   - `VPS_API_TOKEN`: METRICS_TOKEN از مرحله نصب

2. Workflow را فعال کنید:
   - به تب Actions بروید
   - Price Fetcher workflow را enable کنید
   - یک بار دستی اجرا کنید

### 5. تنظیم Webhook تلگرام

```bash
TELEGRAM_BOT_TOKEN="your_bot_token"
WEBHOOK_URL="https://your-domain.ir/api/v1/bot/webhook"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"edited_message\"]}"
```

## مدیریت سرویس‌ها

```bash
# Check status
docker compose -f docker-compose.ir-vps.yml ps

# View logs
docker compose -f docker-compose.ir-vps.yml logs -f api
docker compose -f docker-compose.ir-vps.yml logs -f worker

# Restart services
docker compose -f docker-compose.ir-vps.yml restart

# Backup database
./scripts/backup-db.sh

# Restore database
./scripts/restore-db.sh /path/to/backup.sql.gz
```

## نکات مهم

1. **دامنه**: حتماً یک دامنه .ir یا هر دامنه‌ای که DNS آن را کنترل کنید داشته باشید
2. **DNS**: A record باید به IP VPS اشاره کند
3. **SSL**: اسکریپت نصب SSL را با Let's Encrypt تنظیم می‌کند
4. **Price Fetching**: GitHub Actions هر 5 دقیقه قیمت‌ها را می‌گیرد
5. **Security**: فایروال UFW فعال است و فقط پورت‌های 80 و 443 باز هستند

## هزینه تقریبی

- VPS ایرانی (2GB RAM): ~150,000 تومان/ماه
- دامنه .ir: ~100,000 تومان/سال
- GitHub Actions: رایگان
- **مجموع**: ~2,000,000 تومان/سال

## پشتیبانی

برای جزئیات بیشتر، `docs/IRANIAN_VPS_DEPLOYMENT.md` را بخوانید.
