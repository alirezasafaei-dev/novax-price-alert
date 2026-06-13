import { ALERT_LIFECYCLE, formatNormalizedTarget, operatorLabel } from "./alert-flow.js";
import { getAssetByCanonicalId, getAssetByMarketSymbol } from "./asset-catalog.js";
import { formatPrice, unitForMarket } from "./prices.js";
import { logEvent } from "./log.js";
import { recordMetric } from "./metrics.js";

// Bounded retry policy for notification delivery (mirrors the backend retry
// contract in docs/ALERT_HARDENING_CONTRACTS.md: 3 attempts with backoff).
export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = 60 * 1000;
export const MAX_ALERTS_PER_USER = 5;

export async function getUserAlerts(env, chatId) {
  const key = `alerts:user:${chatId}`;
  const data = await env.ALERTS_KV.get(key, "json");
  return data || [];
}

export async function saveUserAlerts(env, chatId, alerts) {
  const key = `alerts:user:${chatId}`;
  await env.ALERTS_KV.put(key, JSON.stringify(alerts));
}

export async function createAlert(env, chatId, alertData) {
  const alerts = await getUserAlerts(env, chatId);
  const manageableStates = new Set([
    ALERT_LIFECYCLE.ACTIVE,
    ALERT_LIFECYCLE.PAUSED,
    ALERT_LIFECYCLE.FAILED,
    ALERT_LIFECYCLE.PENDING_CONFIRMATION,
  ]);
  const currentCount = alerts.filter(
    (alert) => manageableStates.has(alert.lifecycle_state || ALERT_LIFECYCLE.ACTIVE),
  ).length;
  if (currentCount >= MAX_ALERTS_PER_USER) {
    const error = new Error("به حداکثر تعداد هشدارهای مجاز این نسخه رسیده‌اید. لطفاً ابتدا یکی از هشدارهای فعلی را حذف کنید.");
    error.code = "MAX_ALERTS_REACHED";
    throw error;
  }
  const asset =
    getAssetByCanonicalId(alertData.canonical_asset_id) ||
    getAssetByMarketSymbol(alertData.market, alertData.symbol);
  const alertId = alertData.id || crypto.randomUUID().split("-")[0];
  const newAlert = {
    id: alertId,
    alert_id: alertId,
    user_id: String(chatId),
    canonical_asset_id: asset?.canonical_asset_id || `${alertData.market}:${alertData.symbol}`,
    market: alertData.market,
    symbol: alertData.symbol,
    display_asset_name_at_creation:
      alertData.display_asset_name_at_creation || asset?.display_name || alertData.symbol,
    operator: alertData.operator,
    condition_type: alertData.operator,
    target: alertData.target,
    target_price_normalized: alertData.target,
    target_price_display_unit: alertData.target_price_display_unit || asset?.unit || unitForMarket(alertData.market),
    lifecycle_state: ALERT_LIFECYCLE.ACTIVE,
    enabled: true,
    created_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    triggered_at: null,
    delivered_at: null,
    trigger_event_id: null,
    paused_at: null,
    attempt_count: 0,
    max_attempts: DEFAULT_MAX_DELIVERY_ATTEMPTS,
    next_retry_at: null,
    repeat_every_minutes: alertData.repeat_every_minutes || null,
    next_trigger_at: null,
    error_message: null,
    metadata: { source: "cloudflare_worker_bot" },
  };
  alerts.push(newAlert);
  await saveUserAlerts(env, chatId, alerts);
  logEvent("alert_activated", {
    alert_id: newAlert.id,
    user_id: String(chatId),
    canonical_asset_id: newAlert.canonical_asset_id,
  });
  recordMetric(env, "alert_created", { market: newAlert.market, asset: newAlert.canonical_asset_id });
  return newAlert;
}

export async function deleteAlert(env, chatId, alertId) {
  const alerts = await getUserAlerts(env, chatId);
  const filtered = alerts.filter((a) => a.id !== alertId);
  await saveUserAlerts(env, chatId, filtered);
  if (filtered.length < alerts.length) {
    logEvent("alert_cancelled", { alert_id: alertId, user_id: String(chatId) });
  }
  return filtered.length < alerts.length;
}

export async function getAllActiveAlerts(env) {
  const list = await env.ALERTS_KV.list({ prefix: "alerts:user:" });
  const allAlerts = [];
  const now = Date.now();

  for (const key of list.keys) {
    const alerts = await env.ALERTS_KV.get(key.name, "json");
    if (alerts) {
      const chatId = key.name.replace("alerts:user:", "");
      for (const alert of alerts) {
        const state = alert.lifecycle_state || (alert.enabled ? ALERT_LIFECYCLE.ACTIVE : ALERT_LIFECYCLE.CANCELLED);
        const nextTriggerAt = alert.next_trigger_at ? Date.parse(alert.next_trigger_at) : null;
        const readyToRun = !nextTriggerAt || Number.isNaN(nextTriggerAt) || nextTriggerAt <= now;
        if (alert.enabled && state === ALERT_LIFECYCLE.ACTIVE && !alert.triggered_at && readyToRun) {
          allAlerts.push({ ...alert, chat_id: chatId, lifecycle_state: state });
        }
      }
    }
  }

  return allAlerts;
}

// Stable per-trigger idempotency key. It must NOT depend on the per-run observed_at
// or the live price, otherwise retries would produce a new key and the
// notification_sent guard could double-send. Each one-shot alert has a single
// logical trigger over its lifetime, keyed by its condition.
export function buildTriggerEventId(alert) {
  return `alert:${alert.id}:${alert.operator}:${alert.target}`;
}

export async function claimAlertForDelivery(env, chatId, alertId, eventId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert || !alert.enabled || alert.triggered_at) return null;

  const state = alert.lifecycle_state || ALERT_LIFECYCLE.ACTIVE;
  if (state !== ALERT_LIFECYCLE.ACTIVE) return null;
  if (alert.next_trigger_at && Date.parse(alert.next_trigger_at) > Date.now()) return null;

  const now = new Date().toISOString();
  alert.lifecycle_state = ALERT_LIFECYCLE.DELIVERY_IN_PROGRESS;
  alert.trigger_event_id = eventId;
  alert.triggered_at = now;
  alert.attempt_count = (alert.attempt_count || 0) + 1;
  alert.next_retry_at = null;
  await saveUserAlerts(env, chatId, alerts);
  return alert;
}

export async function markAlertDelivered(env, chatId, alertId, eventId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (alert && alert.trigger_event_id === eventId) {
    alert.delivered_at = new Date().toISOString();
    if (alert.repeat_every_minutes && Number(alert.repeat_every_minutes) > 0) {
      alert.lifecycle_state = ALERT_LIFECYCLE.ACTIVE;
      alert.enabled = true;
      alert.triggered_at = null;
      alert.trigger_event_id = null;
      alert.next_trigger_at = new Date(Date.now() + Number(alert.repeat_every_minutes) * 60 * 1000).toISOString();
    } else {
      alert.lifecycle_state = ALERT_LIFECYCLE.DELIVERED;
      alert.enabled = false;
      alert.next_trigger_at = null;
    }
    await saveUserAlerts(env, chatId, alerts);
  }
}

export async function markAlertDeliveryFailed(env, chatId, alertId, eventId, error) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert || alert.trigger_event_id !== eventId) return { retryable: false };

  alert.error_message = String(error?.message || error).slice(0, 500);
  const attempts = alert.attempt_count || 0;
  const maxAttempts = alert.max_attempts || DEFAULT_MAX_DELIVERY_ATTEMPTS;

  if (attempts < maxAttempts) {
    // Bounded retry: hand the alert back to the active set so the next cron run
    // re-attempts delivery. The stable trigger_event_id is preserved so the
    // notification_sent guard still prevents a double-send.
    alert.lifecycle_state = ALERT_LIFECYCLE.ACTIVE;
    alert.enabled = true;
    alert.triggered_at = null;
    alert.next_retry_at = new Date(Date.now() + RETRY_BACKOFF_MS).toISOString();
    await saveUserAlerts(env, chatId, alerts);
    return { retryable: true, attempts, maxAttempts };
  }

  alert.lifecycle_state = ALERT_LIFECYCLE.FAILED;
  alert.enabled = false;
  alert.next_retry_at = null;
  await saveUserAlerts(env, chatId, alerts);
  return { retryable: false, attempts, maxAttempts };
}

export async function pauseAlert(env, chatId, alertId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert || alert.lifecycle_state !== ALERT_LIFECYCLE.ACTIVE) return null;
  alert.lifecycle_state = ALERT_LIFECYCLE.PAUSED;
  alert.enabled = false;
  alert.paused_at = new Date().toISOString();
  await saveUserAlerts(env, chatId, alerts);
  return alert;
}

export async function resumeAlert(env, chatId, alertId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert || alert.lifecycle_state !== ALERT_LIFECYCLE.PAUSED) return null;
  alert.lifecycle_state = ALERT_LIFECYCLE.ACTIVE;
  alert.enabled = true;
  alert.paused_at = null;
  await saveUserAlerts(env, chatId, alerts);
  return alert;
}

export async function updateAlertTarget(env, chatId, alertId, target, unit) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) return null;
  alert.target = target;
  alert.target_price_normalized = target;
  if (unit) alert.target_price_display_unit = unit;
  alert.lifecycle_state = ALERT_LIFECYCLE.PAUSED;
  alert.enabled = false;
  alert.paused_at = new Date().toISOString();
  await saveUserAlerts(env, chatId, alerts);
  return alert;
}

export async function setAlertRepeat(env, chatId, alertId, repeatEveryMinutes) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) return null;
  alert.repeat_every_minutes = repeatEveryMinutes || null;
  await saveUserAlerts(env, chatId, alerts);
  return alert;
}

export async function markAlertTriggered(env, chatId, alertId) {
  const eventId = `legacy:${alertId}:${new Date().toISOString()}`;
  await claimAlertForDelivery(env, chatId, alertId, eventId);
  await markAlertDelivered(env, chatId, alertId, eventId);
}

function targetText(alert) {
  const unit = alert.target_price_display_unit || unitForMarket(alert.market);
  return formatNormalizedTarget(alert.target, unit, alert.market);
}

export function formatAlertConfirmation(alert, currentPrice, unit = "") {
  const targetUnit = unit || alert.target_price_display_unit || unitForMarket(alert.market);
  const target = formatNormalizedTarget(alert.target, targetUnit, alert.market);
  const current = currentPrice ? `${currentPrice} ${targetUnit}` : "نامشخص";
  return `لطفاً هشدار را بررسی و تایید کن:

دارایی: ${alert.display_asset_name_at_creation || alert.symbol}
شرط: ${operatorLabel(alert.operator)} ${target}
قیمت فعلی: ${current}

بعد از تایید، هشدار فعال می‌شود.`;
}

// متن تک‌خطی هر هشدار برای لیست (همراه دکمه‌ی حذف)
export function formatAlertLine(alert, index, currentPriceText) {
  const num = `${index + 1}️⃣`;
  const assetName = alert.display_asset_name_at_creation || alert.symbol;
  const lines = [`${num} ${assetName} ${operatorLabel(alert.operator)} ${targetText(alert)}`];
  if (currentPriceText) {
    lines.push(`   قیمت فعلی: ${currentPriceText}`);
  }
  if (alert.lifecycle_state === ALERT_LIFECYCLE.PAUSED) {
    lines.push("   وضعیت: ⏸ متوقف");
  } else if (alert.repeat_every_minutes) {
    lines.push(`   تکرار: هر ${alert.repeat_every_minutes} دقیقه`);
  }
  return lines.join("\n");
}

export function formatAlertNotification(alert, currentPrice) {
  const unit = alert.target_price_display_unit || unitForMarket(alert.market);
  const current = `${currentPrice}${unit ? " " + unit : ""}`;
  const assetName = alert.display_asset_name_at_creation || alert.symbol;
  return `🔔 هشدار قیمت!

${assetName} به ${current} رسید
شرط شما: ${operatorLabel(alert.operator)} ${targetText(alert)}

این هشدار غیرفعال شد.`;
}
