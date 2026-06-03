import { ALERT_LIFECYCLE, formatNormalizedTarget, operatorLabel } from "./alert-flow.js";
import { getAssetByCanonicalId, getAssetByMarketSymbol } from "./asset-catalog.js";
import { formatPrice, unitForMarket } from "./prices.js";

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
    metadata: { source: "cloudflare_worker_bot" },
  };
  alerts.push(newAlert);
  await saveUserAlerts(env, chatId, alerts);
  console.log("alert_activated", {
    alert_id: newAlert.id,
    user_id: String(chatId),
    canonical_asset_id: newAlert.canonical_asset_id,
  });
  return newAlert;
}

export async function deleteAlert(env, chatId, alertId) {
  const alerts = await getUserAlerts(env, chatId);
  const filtered = alerts.filter((a) => a.id !== alertId);
  await saveUserAlerts(env, chatId, filtered);
  if (filtered.length < alerts.length) {
    console.log("alert_cancelled", { alert_id: alertId, user_id: String(chatId) });
  }
  return filtered.length < alerts.length;
}

export async function getAllActiveAlerts(env) {
  const list = await env.ALERTS_KV.list({ prefix: "alerts:user:" });
  const allAlerts = [];

  for (const key of list.keys) {
    const alerts = await env.ALERTS_KV.get(key.name, "json");
    if (alerts) {
      const chatId = key.name.replace("alerts:user:", "");
      for (const alert of alerts) {
        const state = alert.lifecycle_state || (alert.enabled ? ALERT_LIFECYCLE.ACTIVE : ALERT_LIFECYCLE.CANCELLED);
        if (alert.enabled && state === ALERT_LIFECYCLE.ACTIVE && !alert.triggered_at) {
          allAlerts.push({ ...alert, chat_id: chatId, lifecycle_state: state });
        }
      }
    }
  }

  return allAlerts;
}

export function buildTriggerEventId(alert, currentPrice, observedAt) {
  return `alert:${alert.id}:observed:${observedAt}:price:${currentPrice}`;
}

export async function claimAlertForDelivery(env, chatId, alertId, eventId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert || !alert.enabled || alert.triggered_at) return null;

  const state = alert.lifecycle_state || ALERT_LIFECYCLE.ACTIVE;
  if (state !== ALERT_LIFECYCLE.ACTIVE) return null;

  const now = new Date().toISOString();
  alert.lifecycle_state = ALERT_LIFECYCLE.DELIVERY_IN_PROGRESS;
  alert.trigger_event_id = eventId;
  alert.triggered_at = now;
  await saveUserAlerts(env, chatId, alerts);
  return alert;
}

export async function markAlertDelivered(env, chatId, alertId, eventId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (alert && alert.trigger_event_id === eventId) {
    alert.lifecycle_state = ALERT_LIFECYCLE.DELIVERED;
    alert.enabled = false;
    alert.delivered_at = new Date().toISOString();
    await saveUserAlerts(env, chatId, alerts);
  }
}

export async function markAlertDeliveryFailed(env, chatId, alertId, eventId, error) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find((a) => a.id === alertId);
  if (alert && alert.trigger_event_id === eventId) {
    alert.lifecycle_state = ALERT_LIFECYCLE.FAILED;
    alert.enabled = false;
    alert.error_message = String(error?.message || error).slice(0, 500);
    await saveUserAlerts(env, chatId, alerts);
  }
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
