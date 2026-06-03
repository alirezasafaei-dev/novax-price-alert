// ساختار لاگ یکپارچه برای Worker (T-401/T-402).
// هر رویداد به‌صورت یک خط JSON منتشر می‌شود با کلیدهای ثابت:
//   - event: نام رویداد (snake_case)
//   - level: info | warn | error
//   - ts:    زمان ثبت به‌صورت ISO-8601
// و سپس فیلدهای اختصاصی رویداد (alert_id, user_id, worker_run_id, ...).
// خروجی تک‌خطیِ JSON باعث می‌شود لاگ‌ها در `wrangler tail` و Cloudflare Logpush
// قابل فیلتر و کوئری روی فیلدها باشند (به‌جای رشته‌های آزاد).

const LEVEL = { info: "info", warn: "warn", error: "error" };

function emit(level, event, fields) {
  const record = { event, level, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(record);
  if (level === LEVEL.error) {
    console.error(line);
  } else if (level === LEVEL.warn) {
    console.warn(line);
  } else {
    console.log(line);
  }
  return record;
}

// رویداد عادی (مسیر موفق/اطلاعاتی).
export function logEvent(event, fields = {}) {
  return emit(LEVEL.info, event, fields);
}

// وضعیت تنزل‌یافته اما نه خطا (مثل داده‌ی کهنه یا تلاش مجدد).
export function logWarn(event, fields = {}) {
  return emit(LEVEL.warn, event, fields);
}

// خطا (شکست ارسال، استثناهای پیش‌بینی‌نشده).
export function logError(event, fields = {}) {
  return emit(LEVEL.error, event, fields);
}
