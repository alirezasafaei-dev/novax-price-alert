# نحوه استفاده از فایل‌های VPS

فایل‌های زیر با پسوند `.ir-vps` ایجاد شده‌اند تا با فایل‌های فعلی پروژه تداخل نداشته باشند.

## قبل از استفاده، فایل‌ها را rename کنید:

```bash
cd /opt/novax-price-alert

# Rename docker-compose
mv docker-compose.ir-vps.yml docker-compose.yml

# Rename nginx config
mv nginx.ir-vps.conf nginx.conf

# Rename Dockerfile (اگر لازم است)
mv Dockerfile.ir-vps Dockerfile
```

## یا در اسکریپت‌ها از مسیر کامل استفاده کنید:

```bash
docker compose -f docker-compose.ir-vps.yml up -d
```

این روش به شما اجازه می‌دهد همزمان هر دو نسخه (Cloudflare+Render و VPS ایرانی) را داشته باشید.
