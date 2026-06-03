// هشدار عملیاتی (T-405): پیام‌های هشدار داخلی از طریق همان بات تلگرام به یک چت ops.
//
// مقصد با OPS_CHAT_ID تعیین می‌شود (متغیر/سکرت Worker). اگر تنظیم نشده باشد
// به‌صورت بی‌خطر no-op است تا قبل از پیکربندی، رفتار Worker تغییر نکند.
//
// برای جلوگیری از اسپم (cron هر ۱۰ دقیقه اجرا می‌شود) از یک cooldown مبتنی بر KV
// استفاده می‌کنیم: هر کلید هشدار تا پایان cooldown فقط یک‌بار ارسال می‌شود.
import { sendMessage } from "./telegram.js";
import { logEvent, logError } from "./log.js";

const DEFAULT_COOLDOWN_SECONDS = 60 * 60; // ۱ ساعت

// آیا برای این کلید هشدار، خارج از بازه‌ی cooldown هستیم؟ (و اگر بله، قفل را ست کن)
export async function shouldAlert(env, key, cooldownSeconds = DEFAULT_COOLDOWN_SECONDS) {
  const kv = env?.ALERTS_KV;
  if (!kv) return true;
  const cooldownKey = `ops_alert_cooldown:${key}`;
  const seen = await kv.get(cooldownKey);
  if (seen) return false;
  await kv.put(cooldownKey, "1", { expirationTtl: cooldownSeconds });
  return true;
}

// ارسال یک پیام هشدار عملیاتی به چت ops. اگر OPS_CHAT_ID نباشد no-op.
export async function sendOpsAlert(env, title, fields = {}) {
  const opsChatId = env?.OPS_CHAT_ID;
  if (!opsChatId) return false;

  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`);
  const text = `🚨 ${title}\n${lines.join("\n")}`;

  try {
    const { response, result } = await sendMessage(env, opsChatId, text);
    if (!response?.ok || result?.ok === false) {
      logError("ops_alert_failed", { title, status: response?.status, description: result?.description });
      return false;
    }
    logEvent("ops_alert_sent", { title });
    return true;
  } catch (error) {
    logError("ops_alert_failed", { title, error_message: String(error?.message || error) });
    return false;
  }
}

// ارسال هشدار فقط در صورت عبور از cooldown (ترکیب shouldAlert + sendOpsAlert).
export async function maybeOpsAlert(env, key, title, fields = {}, cooldownSeconds = DEFAULT_COOLDOWN_SECONDS) {
  if (!env?.OPS_CHAT_ID) return false;
  if (!(await shouldAlert(env, key, cooldownSeconds))) return false;
  return sendOpsAlert(env, title, fields);
}
