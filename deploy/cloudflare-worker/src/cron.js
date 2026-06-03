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
import { logEvent, logWarn, logError } from "./log.js";
import { recordMetric } from "./metrics.js";
import { maybeOpsAlert } from "./alerting.js";

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
    logEvent("alert_evaluation_job_completed", { worker_run_id: workerRunId, checked: 0, triggered: 0 });
    return { checked: 0, triggered: 0 };
  }

  const cryptoPrices = await getCryptoPrices();
  const iranPrices = await getIranMarketPrices();
  const cryptoFreshness = classifyPriceBatch(cryptoPrices, "crypto");
  const iranFreshness = classifyPriceBatch(iranPrices, "iran_market");

  // قطعی provider: متریک + هشدار عملیاتی (با cooldown تا اسپم نشود).
  for (const [market, fresh] of [["crypto", cryptoFreshness], ["iran_market", iranFreshness]]) {
    if (fresh.freshness !== "fresh") {
      recordMetric(env, "provider_outage", { market });
      await maybeOpsAlert(env, `provider_outage:${market}`, "Provider outage", {
        provider: market,
        reason: fresh.reason,
        worker_run_id: workerRunId,
      });
    }
  }

  let checked = 0;
  let triggered = 0;

  for (const alert of alerts) {
    checked++;
    const priceBatch = alert.market === "crypto" ? cryptoPrices : iranPrices;
    const freshness = alert.market === "crypto" ? cryptoFreshness : iranFreshness;

    if (freshness.freshness !== "fresh") {
      logWarn("stale_data_detected", {
        alert_id: alert.id,
        user_id: String(alert.chat_id),
        canonical_asset_id: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
        worker_run_id: workerRunId,
        freshness: freshness.freshness,
        reason: freshness.reason,
      });
      recordMetric(env, "stale_data", { market: alert.market });
      continue;
    }

    const currentPrice = priceBatch?.[alert.symbol];

    if (!currentPrice) {
      logWarn("stale_data_detected", {
        alert_id: alert.id,
        user_id: String(alert.chat_id),
        canonical_asset_id: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
        worker_run_id: workerRunId,
        freshness: "unavailable",
        reason: "asset_price_missing",
      });
      recordMetric(env, "stale_data", { market: alert.market });
      continue;
    }

    const conditionMatched =
      (alert.operator === "above" && currentPrice > alert.target) ||
      (alert.operator === "below" && currentPrice < alert.target);

    logEvent("alert_evaluated", {
      alert_id: alert.id,
      user_id: String(alert.chat_id),
      canonical_asset_id: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
      worker_run_id: workerRunId,
      price: currentPrice,
      freshness: freshness.freshness,
      condition_matched: conditionMatched,
    });
    recordMetric(env, "alert_evaluated", {
      market: alert.market,
      asset: alert.canonical_asset_id || `${alert.market}:${alert.symbol}`,
    });

    if (!conditionMatched) continue;

    const eventId = buildTriggerEventId(alert);
    if (await alreadySent(env, eventId)) {
      logEvent("duplicate_send_detected", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      continue;
    }

    const claimed = await claimAlertForDelivery(env, alert.chat_id, alert.id, eventId);
    if (!claimed) {
      logEvent("duplicate_trigger_detected", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      continue;
    }

    try {
      logEvent("notification_send_started", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      const text = formatAlertNotification(claimed, formatPrice(currentPrice));
      const { response, result } = await sendMessage(env, alert.chat_id, text);
      // sendMessage resolves even on Telegram API errors (e.g. 429 rate-limit,
      // 403 bot blocked); surface them so they are treated as failed delivery
      // instead of being silently recorded as delivered.
      if (!response?.ok || result?.ok === false) {
        const description = result?.description || `HTTP ${response?.status}`;
        throw new Error(`telegram_send_failed: ${description}`);
      }
      await markSent(env, eventId);
      await markAlertDelivered(env, alert.chat_id, alert.id, eventId);
      triggered++;
      logEvent("notification_send_succeeded", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
      });
      recordMetric(env, "notification_sent", { market: alert.market });
    } catch (error) {
      const outcome = await markAlertDeliveryFailed(env, alert.chat_id, alert.id, eventId, error);
      logError("notification_send_failed", {
        alert_id: alert.id,
        event_id: eventId,
        worker_run_id: workerRunId,
        error_message: String(error?.message || error),
        retryable: outcome?.retryable === true,
        attempt: outcome?.attempts,
        max_attempts: outcome?.maxAttempts,
      });
      recordMetric(env, "notification_failed", { market: alert.market });
      // فقط شکست نهایی (غیرقابل‌retry / اتمام تلاش‌ها) را به ops هشدار بده تا اسپم نشود.
      if (outcome?.retryable === false) {
        await maybeOpsAlert(env, `delivery_failed:${alert.id}:${eventId}`, "Alert delivery failed", {
          alert_id: alert.id,
          market: alert.market,
          attempts: outcome?.attempts,
          error: String(error?.message || error),
        });
      }
    }
  }

  logEvent("alert_evaluation_job_completed", { worker_run_id: workerRunId, checked, triggered });
  return { checked, triggered };
}
