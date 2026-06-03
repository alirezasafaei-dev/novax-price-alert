import {
  buildTriggerEventId,
  claimAlertForDelivery,
  formatAlertNotification,
  getAllActiveAlerts,
  markAlertDelivered,
  markAlertDeliveryFailed,
} from "./alerts.js";
import { getCryptoPrices, getIranMarketPrices, formatPrice } from "./prices.js";
import { sendMessage } from "./telegram.js";

function classifyPriceBatch(prices, providerId) {
  if (!prices || Object.keys(prices).filter((key) => !key.startsWith("_")).length === 0) {
    return { freshness: "unavailable", reason: `${providerId}_prices_unavailable` };
  }
  return { freshness: "fresh", reason: "fetched_during_worker_run", observed_at: new Date().toISOString() };
}

async function alreadySent(env, eventId) {
  return (await env.ALERTS_KV.get(`notification_sent:${eventId}`)) !== null;
}

async function markSent(env, eventId) {
  await env.ALERTS_KV.put(`notification_sent:${eventId}`, "1", { expirationTtl: 60 * 60 * 24 * 30 });
}

export async function runCronJob(env) {
  const workerRunId = crypto.randomUUID();
  const alerts = await getAllActiveAlerts(env);

  if (alerts.length === 0) {
    console.log("alert_evaluation_job_completed", { worker_run_id: workerRunId, checked: 0, triggered: 0 });
    return { checked: 0, triggered: 0 };
  }

  const cryptoPrices = await getCryptoPrices();
  const iranPrices = await getIranMarketPrices();
  const cryptoFreshness = classifyPriceBatch(cryptoPrices, "crypto");
  const iranFreshness = classifyPriceBatch(iranPrices, "iran_market");

  let checked = 0;
  let triggered = 0;

  for (const alert of alerts) {
    checked++;
    const priceBatch = alert.market === "crypto" ? cryptoPrices : iranPrices;
    const freshness = alert.market === "crypto" ? cryptoFreshness : iranFreshness;

    if (freshness.freshness !== "fresh") {
      console.log("stale_data_detected", {
        alert_id: alert.id,
        user_id: String(alert.chat_id),
        canonical_asset_id: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
        worker_run_id: workerRunId,
        freshness: freshness.freshness,
        reason: freshness.reason,
      });
      continue;
    }

    const currentPrice = priceBatch?.[alert.symbol];

    if (!currentPrice) {
      console.log("stale_data_detected", {
        alert_id: alert.id,
        user_id: String(alert.chat_id),
        canonical_asset_id: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
        worker_run_id: workerRunId,
        freshness: "unavailable",
        reason: "asset_price_missing",
      });
      continue;
    }

    const conditionMatched =
      (alert.operator === "above" && currentPrice > alert.target) ||
      (alert.operator === "below" && currentPrice < alert.target);

    console.log("alert_evaluated", {
      alert_id: alert.id,
      user_id: String(alert.chat_id),
      canonical_asset_id: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
      worker_run_id: workerRunId,
      price: currentPrice,
      freshness: freshness.freshness,
      condition_matched: conditionMatched,
    });

    if (!conditionMatched) continue;

    const eventId = buildTriggerEventId(alert, currentPrice, freshness.observed_at);
    if (await alreadySent(env, eventId)) {
      console.log("duplicate_send_detected", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      continue;
    }

    const claimed = await claimAlertForDelivery(env, alert.chat_id, alert.id, eventId);
    if (!claimed) {
      console.log("duplicate_trigger_detected", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      continue;
    }

    try {
      console.log("notification_send_started", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      const text = formatAlertNotification(claimed, formatPrice(currentPrice));
      await sendMessage(env, alert.chat_id, text);
      await markSent(env, eventId);
      await markAlertDelivered(env, alert.chat_id, alert.id, eventId);
      triggered++;
      console.log("notification_send_succeeded", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
    } catch (error) {
      await markAlertDeliveryFailed(env, alert.chat_id, alert.id, eventId, error);
      console.log("notification_send_failed", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
        error_message: String(error?.message || error),
      });
    }
  }

  console.log("alert_evaluation_job_completed", { worker_run_id: workerRunId, checked, triggered });
  return { checked, triggered };
}
