# Novax Price Alert

سامانهٔ سبک و menu-driven هشدار قیمت در تلگرام.

## وضعیت فعلی

- مسیر production: Cloudflare Worker + D1
- Mini-app: روی همان Worker
- قیمت کریپتو: Binance با واحد `USDT`
- قیمت فیات، تتر و طلا: TGJU با واحد تومان
- هشدارها فقط بعد از تأیید صریح فعال می‌شوند
- cron هر دقیقه اجرا می‌شود؛ پلن Free هر ۱۰ دقیقه و Pro هر دقیقه بررسی می‌شود

## شروع توسعه

```bash
uv sync
uv run pytest
uv run ruff check .
uv run mypy src
```

تست Worker:

```bash
cd deploy/cloudflare-worker
npm test
```

## مستندات معتبر

1. [فهرست مستندات](docs/README.md)
2. [وضعیت پیاده‌سازی](docs/PROGRESS.md)
3. [معماری](docs/ARCHITECTURE.md)
4. [عملیات production](docs/OPERATIONS.md)
5. [راهنمای Worker و D1](deploy/cloudflare-worker/README.md)
6. [امنیت](SECURITY.md)

اسناد قدیمی deployment، VPS، checklist و گزارش‌های مقطعی در
[`docs/archive/`](docs/archive/) نگهداری می‌شوند و مرجع عملیاتی نیستند.

## ساختار اصلی

- `src/novax_price_alert/`: backend قدیمی FastAPI و منطق دامنه
- `deploy/cloudflare-worker/`: مسیر اصلی production
- `mini-app/`: رابط React
- `tests/`: تست‌های Python
- `migrations/versions/`: migrationهای backend قدیمی

## امنیت

هیچ token، password، connection string واقعی، شناسهٔ خصوصی یا خروجی حاوی
secret نباید وارد issue، log، screenshot یا git شود. در صورت افشا، حذف از فایل
کافی نیست: credential باید فوراً rotate و تاریخچهٔ git نیز پاک‌سازی شود.
