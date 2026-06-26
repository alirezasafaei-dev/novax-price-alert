# راهنمای دیپلوی نهایی — Novax Price Alert v0.3.0

## اطلاعات سرور
- **IP**: <redacted-vps-host>
- **User**: ubuntu
- **SSH Key**: ~/.ssh/novax_deploy
- **Project Path**: /home/ubuntu/novax-price-alert (یا مسیری که روی سرور تنظیم شده)

## مراحل دیپلوی

### 1. اتصال به سرور
```bash
ssh -i ~/.ssh/novax_deploy ubuntu@<redacted-vps-host>
```

### 2. آپدیت پروژه
```bash
cd /home/ubuntu/novax-price-alert
git pull origin main
```

### 3. نصب وابستگی‌ها
```bash
uv sync
```

### 4. اجرای مایگریشن‌ها
```bash
uv run alembic upgrade head
```

### 5. ساخت دیتابیس SQLite (اگر PostgreSQL ندارید)
پروژه خودکار به SQLite fallback می‌ره اگر PostgreSQL در دسترس نباشد.

### 6. سید دیتا
```bash
uv run python -m novax_price_alert.scripts.seed_mvp
```

### 7. اجرای API
```bash
uv run uvicorn novax_price_alert.main:app --host 0.0.0.0 --port 8000
```

### 8. تست سلامت
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/prices/latest
```

## نکات مهم
- فایل `.env` روی سرور باید شامل `TELEGRAM_BOT_TOKEN`، `TELEGRAM_RELAY_URL` و `TELEGRAM_RELAY_SECRET` باشد
- اگر از PostgreSQL استفاده می‌کنید، `DATABASE_URL` را در `.env` تنظیم کنید
- برای production بهتر است از systemd یا PM2 برای اجرای پایدار API و worker استفاده شود
