# Recent Changes

**تاریخ آخرین آپدیت**: 2026-06-12

## بهبودهای اخیر

### فارسی‌سازی کامل UI (Persian Localization)
- ✅ تمام متن‌های کاربری به فارسی ترجمه شدند
- ✅ اعداد در پیام‌های تلگرام با فرمت فارسی نمایش داده می‌شوند
- ✅ اضافه کردن تابع `to_persian_digits()` برای تبدیل اعداد
- ✅ به‌روزرسانی دکمه‌ها و منوهای TWA به فارسی کامل
- ✅ اصلاح وضعیت‌های انگلیسی در admin panel

### بهبود کیفیت کد (Code Quality)
- ✅ رفع تمام خطاهای Ruff linting
- ✅ اضافه کردن request logging middleware
- ✅ بهبود health check endpoint با error handling
- ✅ جدا کردن integration tests از unit tests
- ✅ حذف hardcoded passwords از deployment scripts

### اصلاح مشکلات GitHub Actions
- ✅ غیرفعال کردن health-check monitor (مزاحمت گروه تلگرام)
- ✅ غیرفعال کردن cron-heartbeat monitor (مزاحمت گروه تلگرام)
- ✅ محدود کردن CI failure notifications فقط به main branch

### بهبودهای امنیتی (Security)
- ✅ حذف اسرار از مستندات (placeholder جایگزین)
- ✅ استفاده از environment variables برای حساس‌ها
- ✅ بهبود token validation در API endpoints

### بهبودهای Performance
- ✅ بهینه‌سازی ایندکس‌های دیتابیس
- ✅ بهبود error handling در API endpoints
- ✅ اضافه کردن observability و logging

## تغییرات در ساختار پروژه

### Tests
- انتقال integration tests به پوشه `tests/integration/`
- پیکربندی pytest برای نادیده گرفتن integration tests در اجرای عادی
- 151 unit test پاس شد

### Scripts
- اضافه کردن deployment scripts جدید
- اضافه کردن monitoring scripts
- اضافه کردن sync scripts

### Documentation
- اضافه کردن comprehensive documentation
- راهنماهای deployment و setup
- گزارش‌های وضعیت و progress

## فایل‌های کلیدی تغییر یافته

### Source Code
- `src/novax_price_alert/api/templates.py` - TWA فارسی‌سازی
- `src/novax_price_alert/infra/notifications/telegram.py` - پیام‌های فارسی
- `src/novax_price_alert/domain/pricing.py` - اعداد فارسی
- `src/novax_price_alert/api/main.py` - request logging
- `src/novax_price_alert/api/health.py` - health check improvements

### GitHub Actions
- `.github/workflows/health-check-monitor.yml` - disabled
- `.github/workflows/cron-heartbeat-monitor.yml` - disabled
- `.github/workflows/ci.yml` - restricted notifications

### Configuration
- `pyproject.toml` - pytest configuration
- Deployment scripts - security improvements

## وضعیت فعلی

### Quality Gates
- ✅ Ruff linting: All checks passed
- ✅ MyPy type checking: Success (83 source files)
- ✅ Unit tests: 151/151 tests passed

### Deployment Status
- 🟢 Server: Live at novax.alirezasafeidev.ir
- 🟢 API: /health endpoint responding
- 🟢 Database: Connected and operational
- 🟢 Services: All systemd services active

### Git
- Latest commit: `9aab822` - "fix: disable spammy GitHub Actions notifications to ops group"
- Branch: main
- Status: Up to date with origin/main

## کارهای آینده

### Priority 1 (فوری)
- Fix API_BASE_URL secret in GitHub Actions for health checks
- Re-enable monitors when server is stable

### Priority 2 (کوتاه مدت)
- اضافه کردن بیشتر integration tests
- بهبود coverage tests
- اضافه کردن performance monitoring

### Priority 3 (طولانی مدت)
- بهبود AI features
- اضافه کردن premium features
- بهبود mobile responsiveness

## نکات مهم

- تمام متن‌های کاربری اکنون فارسی هستند
- پیام‌های مزاحمت تلگرام متوقف شده‌اند
- سرور در production است و کار می‌کند
- GitHub Actions monitors موقتاً disabled هستند
- Documentation به‌روز است

---
*آخرین بروزرسانی: 2026-06-12*
