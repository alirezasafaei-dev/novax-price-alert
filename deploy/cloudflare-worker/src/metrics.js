// متریک‌های پایه روی Cloudflare Workers Analytics Engine (T-403).
//
// از binding با نام METRICS استفاده می‌کند (در wrangler.toml تعریف می‌شود).
// اگر binding تنظیم نشده باشد (مثل محیط تست یا قبل از deploy) به‌صورت بی‌خطر
// no-op است و هرگز throw نمی‌کند، تا منطق اصلی Worker تحت تأثیر قرار نگیرد.
//
// طرح داده‌نقطه:
//   - indexes: [name]            نام متریک برای گروه‌بندی/نمونه‌گیری (حداکثر ۱)
//   - blobs:   [name, market, asset]   ابعاد رشته‌ای
//   - doubles: [value]           مقدار عددی (پیش‌فرض ۱ برای شمارش)
//
// نمونه‌ی کوئری (Analytics Engine SQL):
//   SELECT blob1 AS metric, SUM(double1) AS total
//   FROM novax_bot_metrics GROUP BY metric;
export function recordMetric(env, name, fields = {}) {
  const ae = env?.METRICS;
  if (!ae || typeof ae.writeDataPoint !== "function") return false;
  const { market = "", asset = "", value = 1 } = fields;
  try {
    ae.writeDataPoint({
      indexes: [String(name)],
      blobs: [String(name), String(market ?? ""), String(asset ?? "")],
      doubles: [Number(value) || 0],
    });
    return true;
  } catch {
    // متریک نباید مسیر اصلی را بشکند.
    return false;
  }
}
