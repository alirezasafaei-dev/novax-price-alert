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
  const newAlert = {
    id: crypto.randomUUID().split("-")[0],
    market: alertData.market,
    symbol: alertData.symbol,
    operator: alertData.operator,
    target: alertData.target,
    enabled: true,
    created_at: new Date().toISOString(),
    triggered_at: null,
  };
  alerts.push(newAlert);
  await saveUserAlerts(env, chatId, alerts);
  return newAlert;
}

export async function deleteAlert(env, chatId, alertId) {
  const alerts = await getUserAlerts(env, chatId);
  const filtered = alerts.filter(a => a.id !== alertId);
  await saveUserAlerts(env, chatId, filtered);
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
        if (alert.enabled && !alert.triggered_at) {
          allAlerts.push({ ...alert, chat_id: chatId });
        }
      }
    }
  }
  
  return allAlerts;
}

export async function markAlertTriggered(env, chatId, alertId) {
  const alerts = await getUserAlerts(env, chatId);
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.triggered_at = new Date().toISOString();
    await saveUserAlerts(env, chatId, alerts);
  }
}

function opLabel(operator) {
  return operator === "above" ? "بالاتر از" : "پایین‌تر از";
}

function targetText(alert) {
  const unit = unitForMarket(alert.market);
  return `${formatPrice(alert.target)} ${unit}`;
}

export function formatAlertConfirmation(alert, currentPrice, unit = "") {
  const op = opLabel(alert.operator);
  const target = `${formatPrice(alert.target)}${unit ? " " + unit : ""}`;
  const current = currentPrice ? `${currentPrice}${unit ? " " + unit : ""}` : "نامشخص";
  return `لطفاً هشدار را تایید کن:

دارایی: ${alert.symbol}
شرط: ${op} ${target}
قیمت فعلی: ${current}

اگر قیمت ${alert.symbol} ${op} ${target} شد، به تو پیام می‌دهم.`;
}

// متن تک‌خطی هر هشدار برای لیست (همراه دکمه‌ی حذف)
export function formatAlertLine(alert, index, currentPriceText) {
  const op = opLabel(alert.operator);
  const num = `${index + 1}️⃣`;
  const lines = [`${num} ${alert.symbol} ${op} ${targetText(alert)}`];
  if (currentPriceText) {
    lines.push(`   قیمت فعلی: ${currentPriceText}`);
  }
  return lines.join("\n");
}

export function formatAlertNotification(alert, currentPrice) {
  const op = opLabel(alert.operator);
  const unit = unitForMarket(alert.market);
  const current = `${currentPrice}${unit ? " " + unit : ""}`;
  return `🔔 هشدار قیمت!

${alert.symbol} به ${current} رسید
شرط شما: ${op} ${targetText(alert)}

این هشدار غیرفعال شد.`;
}
