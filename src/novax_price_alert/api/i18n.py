"""Centralized Persian (Farsi) error messages for the Novax Price Alert API.

All user-facing error strings live here. Import from this module instead of
hard-coding Persian strings in routers, services, or domain logic.

This file serves as the single source of truth for all API-facing text.
To add a new error message:
  1. Add a constant below with a descriptive name
  2. Add it to the ERRORS dict at the bottom
  3. Import and use in routers/services

Usage:
    from novax_price_alert.api.i18n import ERRORS

    raise HTTPException(404, ERRORS["asset_not_found"])
    raise NotFoundError(ERRORS["alert_not_found"])
"""

# ── Auth / Telegram ──────────────────────────────────────────────
AUTH_TELEGRAM_INIT_DATA_REQUIRED = (
    "داده‌های احراز هویت تلگرام یافت نشد. لطفاً از طریق بات تلگرام وارد شوید."
)
AUTH_INVALID_TOKEN = "احراز هویت ناموفق بود. لطفاً مجدداً از طریق بات تلگرام وارد شوید."
AUTH_ADMIN_TOKEN_MISSING = (
    "توکن مدیریت تنظیم نشده است. لطفاً متغیر ADMIN_ACCESS_TOKEN را در تنظیمات سرور پیکربندی کنید."
)
AUTH_ADMIN_TOKEN_INVALID = (
    "توکن مدیریت نامعتبر است. دسترسی به این بخش محدود به مدیران سیستم است."
)
AUTH_ADMIN_TOKEN_REQUIRED = (
    "توکن مدیریت الزامی است. لطفاً هدر Authorization یا پارامتر ?token= را با مقدار صحیح ارسال کنید."
)
AUTH_INGEST_TOKEN_MISSING = (
    "توکن ارسال قیمت تنظیم نشده است. "
    "لطفاً متغیر INGEST_API_TOKEN را در تنظیمات سرور پیکربندی کنید."
)
AUTH_INGEST_TOKEN_INVALID = (
    "توکن ارسال‌شده نامعتبر است. لطفاً مطمئن شوید INGEST_API_TOKEN صحیح تنظیم شده است."
)
AUTH_BEARER_REQUIRED = "هدر Authorization الزامی است. فرمت صحیح: Bearer <token>"

# ── Generic ──────────────────────────────────────────────────────
GENERIC_NOT_FOUND = "منبع مورد نظر یافت نشد. لطفاً پارامترهای درخواست را بررسی کنید."
GENERIC_BAD_REQUEST = "درخواست نامعتبر است. لطفاً فرمت داده‌های ارسالی را بررسی کنید."
GENERIC_INTERNAL_ERROR = (
    "خطای داخلی سرور رخ داد. لطفاً چند دقیقه دیگر تلاش کنید یا با پشتیبانی تماس بگیرید."
)
GENERIC_SERVICE_UNAVAILABLE = "سرویس موقتاً در دسترس نیست. لطفاً بعداً تلاش کنید."

# ── Asset ────────────────────────────────────────────────────────
ASSET_NOT_FOUND = "دارایی مورد نظر یافت نشد."
ASSET_NOT_FOUND_FOR_SYMBOL = "دارایی با نماد «{symbol}» یافت نشد. لطفاً از لیست دارایی‌ها انتخاب کنید."
ASSET_CODE_MISSING = "نماد دارایی (asset_code) ارسال نشده است."
ASSET_NOT_IN_DB = "دارایی در پایگاه داده ثبت نشده است."
ASSET_PRICE_UNAVAILABLE = (
    "قیمت لحظه‌ای برای این دارایی در دسترس نیست. لطفاً بعداً تلاش کنید."
)

# ── Alert ────────────────────────────────────────────────────────
ALERT_NOT_FOUND = "هشدار مورد نظر یافت نشد. ممکن است حذف شده باشد."
ALERT_INVALID_TRANSITION = "تغییر وضعیت هشدار امکان‌پذیر نیست. لطفاً وضعیت فعلی هشدار را بررسی کنید."
ALREADY_TERMINAL = "هشدار در وضعیت نهایی قرار دارد و دیگر قابل تغییر نیست."
ALERT_MAX_ACTIVE_REACHED = (
    "به حداکثر تعداد هشدارهای مجاز این نسخه رسیده‌اید. "
    "لطفاً ابتدا یکی از هشدارهای فعلی را حذف کنید."
)
ALERT_CREATE_FAILED = "خطا در ایجاد هشدار. لطفاً داده‌های ورودی را بررسی کنید و دوباره تلاش کنید."
ALERT_UPDATE_FAILED = "خطا در به‌روزرسانی هشدار. لطفاً دوباره تلاش کنید."
ALERT_CANCEL_FAILED = "خطا در لغو هشدار. لطفاً دوباره تلاش کنید."
ALERT_CONFIRM_FAILED = "خطا در تأیید هشدار. ممکن است هشدار در وضعیت مناسب نباشد."
ALERT_INVALID_TARGET_PRICE = "قیمت هدف نامعتبر است. لطفاً یک عدد مثبت وارد کنید."
ALERT_INVALID_CONDITION = "شرط هشدار نامعتبر است. گزینه‌های مجاز: «بالاتر از» یا «پایین‌تر از»."

# ── Price / Ingest ──────────────────────────────────────────────
PRICE_SYMBOL_AND_PRICE_REQUIRED = "فیلدهای symbol و price الزامی هستند. لطفاً هر دو را ارسال کنید."
PRICE_INVALID = "قیمت ارسال‌شده نامعتبر است. لطفاً یک عدد مثبت وارد کنید."
PRICE_INGEST_ITEM_FAILED = "پردازش قیمت ناموفق بود. لطفاً فرمت داده را بررسی کنید."
PRICE_DATA_STALE = "داده‌های قیمت قدیمی هستند. لطفاً صبر کنید تا قیمت‌ها به‌روز شوند."
PRICE_PROVIDER_ERROR = "خطا در دریافت قیمت از منبع. لطفاً بعداً تلاش کنید."

# ── Alert Event / Delivery ──────────────────────────────────────
EVENT_DELIVERY_FAILED = (
    "ارسال اعلان با خطا مواجه شد. لطفاً اتصال اینترنت خود را بررسی کنید یا با پشتیبانی تماس بگیرید."
)
MAX_ALERTS_REACHED = "به حداکثر تعداد هشدار فعال رسیده‌اید. لطفاً ابتدا یک هشدار را حذف کنید."
INVALID_ASSET_CODE = "نماد دارایی نامعتبر است. لطفاً از لیست دارایی‌های موجود انتخاب کنید."
PRICE_DATA_UNAVAILABLE = "دریافت قیمت برای این دارایی امکان‌پذیر نیست. لطفاً بعداً تلاش کنید."
RATE_LIMIT_EXCEEDED = "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه صبر کنید."

# ── Validation ───────────────────────────────────────────────────
VALIDATION_ERROR = "داده‌های ارسالی نامعتبر هستند. لطفاً خطاها را بررسی و اصلاح کنید."
FIELD_REQUIRED = "فیلد «{field}» الزامی است."
FIELD_INVALID_TYPE = "فیلد «{field}» باید از نوع {expected_type} باشد."
FIELD_OUT_OF_RANGE = "مقدار فیلد «{field}» باید بین {min} و {max} باشد."

# ── Lookup table for programmatic access ─────────────────────────
ERRORS: dict[str, str] = {
    # Auth
    "auth_telegram_init_data_required": AUTH_TELEGRAM_INIT_DATA_REQUIRED,
    "auth_invalid_token": AUTH_INVALID_TOKEN,
    "auth_admin_token_missing": AUTH_ADMIN_TOKEN_MISSING,
    "auth_admin_token_invalid": AUTH_ADMIN_TOKEN_INVALID,
    "auth_admin_token_required": AUTH_ADMIN_TOKEN_REQUIRED,
    "auth_ingest_token_missing": AUTH_INGEST_TOKEN_MISSING,
    "auth_ingest_token_invalid": AUTH_INGEST_TOKEN_INVALID,
    "auth_bearer_required": AUTH_BEARER_REQUIRED,
    # Generic
    "generic_not_found": GENERIC_NOT_FOUND,
    "generic_bad_request": GENERIC_BAD_REQUEST,
    "generic_internal_error": GENERIC_INTERNAL_ERROR,
    "generic_service_unavailable": GENERIC_SERVICE_UNAVAILABLE,
    # Asset
    "asset_not_found": ASSET_NOT_FOUND,
    "asset_not_found_for_symbol": ASSET_NOT_FOUND_FOR_SYMBOL,
    "asset_code_missing": ASSET_CODE_MISSING,
    "asset_not_in_db": ASSET_NOT_IN_DB,
    "asset_price_unavailable": ASSET_PRICE_UNAVAILABLE,
    # Alert
    "alert_not_found": ALERT_NOT_FOUND,
    "alert_invalid_transition": ALERT_INVALID_TRANSITION,
    "already_terminal": ALREADY_TERMINAL,
    "alert_max_active_reached": ALERT_MAX_ACTIVE_REACHED,
    "alert_create_failed": ALERT_CREATE_FAILED,
    "alert_update_failed": ALERT_UPDATE_FAILED,
    "alert_cancel_failed": ALERT_CANCEL_FAILED,
    "alert_confirm_failed": ALERT_CONFIRM_FAILED,
    "alert_invalid_target_price": ALERT_INVALID_TARGET_PRICE,
    "alert_invalid_condition": ALERT_INVALID_CONDITION,
    # Price
    "price_symbol_and_price_required": PRICE_SYMBOL_AND_PRICE_REQUIRED,
    "price_invalid": PRICE_INVALID,
    "price_ingest_item_failed": PRICE_INGEST_ITEM_FAILED,
    "price_data_stale": PRICE_DATA_STALE,
    "price_provider_error": PRICE_PROVIDER_ERROR,
    # Alert Event / Delivery
    "event_delivery_failed": EVENT_DELIVERY_FAILED,
    "max_alerts_reached": MAX_ALERTS_REACHED,
    "invalid_asset_code": INVALID_ASSET_CODE,
    "price_data_unavailable": PRICE_DATA_UNAVAILABLE,
    "rate_limit_exceeded": RATE_LIMIT_EXCEEDED,
    # Validation
    "validation_error": VALIDATION_ERROR,
    "field_required": FIELD_REQUIRED,
    "field_invalid_type": FIELD_INVALID_TYPE,
    "field_out_of_range": FIELD_OUT_OF_RANGE,
}
