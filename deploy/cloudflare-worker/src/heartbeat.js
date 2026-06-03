// ضربان cron (heartbeat) برای تشخیصِ بیرونیِ «اجرا نشدنِ cron».
//
// نبودِ اجرای cron از داخل خود Worker قابل‌تشخیص نیست (نبودِ اجرا رویدادی تولید
// نمی‌کند). به همین خاطر در پایان هر اجرای scheduled، زمان و شمارش‌ها در KV ثبت
// می‌شود و یک مانیتور بیرونی با خواندن endpoint `/status` می‌تواند کهنه‌شدن این
// ضربان را تشخیص دهد و هشدار بدهد.
const HEARTBEAT_KEY = "cron:last_run";
export const EXPECTED_INTERVAL_SECONDS = 600; // cron هر ۱۰ دقیقه اجرا می‌شود.

// ثبت ضربان در پایان اجرای cron. اگر KV نباشد به‌صورت بی‌خطر no-op است.
export async function recordCronHeartbeat(env, result = {}) {
  const kv = env?.ALERTS_KV;
  if (!kv) return false;
  const payload = {
    ts: new Date().toISOString(),
    checked: Number(result.checked) || 0,
    triggered: Number(result.triggered) || 0,
  };
  try {
    await kv.put(HEARTBEAT_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

// وضعیت ضربان cron برای مصرف بیرونی. آستانه‌ی کهنگی پیش‌فرض = ۳ تیکِ ازدست‌رفته.
export async function getCronStatus(
  env,
  { staleAfterSeconds = EXPECTED_INTERVAL_SECONDS * 3, now = Date.now() } = {},
) {
  const kv = env?.ALERTS_KV;
  let lastRun = null;
  if (kv) {
    try {
      lastRun = await kv.get(HEARTBEAT_KEY, "json");
    } catch {
      lastRun = null;
    }
  }

  if (!lastRun?.ts) {
    return {
      status: "unknown",
      last_cron_run: null,
      age_seconds: null,
      stale: true,
      expected_interval_seconds: EXPECTED_INTERVAL_SECONDS,
      stale_after_seconds: staleAfterSeconds,
    };
  }

  const ageSeconds = Math.max(0, Math.floor((now - Date.parse(lastRun.ts)) / 1000));
  const stale = ageSeconds > staleAfterSeconds;
  return {
    status: stale ? "stale" : "ok",
    last_cron_run: lastRun.ts,
    age_seconds: ageSeconds,
    stale,
    expected_interval_seconds: EXPECTED_INTERVAL_SECONDS,
    stale_after_seconds: staleAfterSeconds,
    checked: lastRun.checked,
    triggered: lastRun.triggered,
  };
}
