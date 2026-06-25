import { ALERT_LIFECYCLE } from "./alert-flow.js";
import { ASSETS, getAssetByMarketSymbol } from "./asset-catalog.js";
import {
  createAlert,
  deleteAlert,
  getUserAlerts,
  pauseAlert,
  resumeAlert,
  updateAlertTarget,
} from "./alerts.js";
import { getCryptoPrices, getIranMarketPrices, unitForMarket } from "./prices.js";
import {
  createPaymentRequest,
  getEntitlement,
  getPriceHistoryDb,
  getUserAlertCount,
  hasProductDb,
  listAlertEventsDb,
  PRO_PRICE_TOMAN,
  upsertUser,
} from "./product-db.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Telegram-Init-Data",
  "Access-Control-Max-Age": "86400",
};

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function error(message, status = 400) {
  return json({ detail: message, error: message }, { status });
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacSha256(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

export async function verifyTelegramInitData(initData, env) {
  if (!initData) throw new Error("telegram initData is required");
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("telegram bot token is not configured");

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("telegram initData hash is missing");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    env.TELEGRAM_BOT_TOKEN,
  );
  const expectedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));
  if (!timingSafeEqual(expectedHash, receivedHash)) {
    throw new Error("telegram initData hash is invalid");
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) throw new Error("telegram initData auth_date is missing");
  const maxAge = Number(env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
  if (Math.floor(Date.now() / 1000) - authDate > maxAge) {
    throw new Error("telegram initData is expired");
  }

  const user = JSON.parse(params.get("user") || "{}");
  const telegramUserId = String(user.id || "");
  if (!telegramUserId) throw new Error("telegram user id is missing");
  return {
    telegram_user_id: telegramUserId,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    language_code: user.language_code || null,
    auth_date: authDate,
  };
}

async function currentUser(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data");
  const user = await verifyTelegramInitData(initData, env);
  await env.USERS_KV?.put?.(`user:${user.telegram_user_id}`, JSON.stringify(user));
  await upsertUser(env, user);
  return user;
}

function assetCodeForWorker(symbol, market) {
  return market === "crypto" ? `${symbol}_USDT` : `${symbol}_IRT`;
}

function publicPriceItem(asset, price, provider) {
  return {
    canonical_asset_id: asset.canonical_asset_id,
    asset_code: assetCodeForWorker(asset.symbol, asset.market),
    symbol: asset.symbol,
    asset_name: asset.display_name,
    price_value: price,
    price: price,
    currency_code: asset.market === "crypto" ? "USDT" : "IRT",
    display_unit: asset.unit,
    provider,
    fetched_at: new Date().toISOString(),
    is_stale: price == null,
    freshness: price == null ? "unavailable" : "fresh",
  };
}

async function latestPrices() {
  const [cryptoPrices, iranPrices] = await Promise.all([getCryptoPrices(), getIranMarketPrices()]);
  const items = Object.values(ASSETS)
    .map((asset) => {
      const source = asset.market === "crypto" ? cryptoPrices : iranPrices;
      const provider = asset.market === "crypto"
        ? (cryptoPrices?._fallback ? "coingecko_fallback" : "binance")
        : "tgju";
      return publicPriceItem(asset, source?.[asset.symbol] ?? null, provider);
    })
    .filter((item) => item.price_value != null);
  return { items };
}

function normalizeAssetCode(assetCode) {
  const code = String(assetCode || "").toUpperCase();
  const aliases = {
    BTC_USDT: ["crypto", "BTC"],
    ETH_USDT: ["crypto", "ETH"],
    SOL_USDT: ["crypto", "SOL"],
    BNB_USDT: ["crypto", "BNB"],
    USDT_IRT: ["fiat", "USDT"],
    USD_IRT: ["fiat", "USD"],
    EUR_IRT: ["fiat", "EUR"],
    GOLD18: ["gold", "GOLD_18K"],
    GOLD_18K_IRT: ["gold", "GOLD_18K"],
    COIN_EMAMI: ["gold", "SEKKEH_EMAMI"],
    SEKKEH_EMAMI_IRT: ["gold", "SEKKEH_EMAMI"],
  };
  if (aliases[code]) return aliases[code];
  if (ASSETS[`crypto:${code}`]) return ["crypto", code];
  if (ASSETS[`fiat:${code}`]) return ["fiat", code];
  if (ASSETS[`gold:${code}`]) return ["gold", code];
  return [null, null];
}

function alertOut(alert, chatId) {
  const asset = getAssetByMarketSymbol(alert.market, alert.symbol);
  const state = alert.lifecycle_state || ALERT_LIFECYCLE.ACTIVE;
  return {
    id: alert.id,
    user_id: String(chatId),
    asset_id: alert.canonical_asset_id,
    asset_code: assetCodeForWorker(alert.symbol, alert.market),
    symbol: alert.symbol,
    asset_name: alert.display_asset_name_at_creation || asset?.display_name || alert.symbol,
    display_asset_name_at_creation: alert.display_asset_name_at_creation || asset?.display_name || alert.symbol,
    condition_type: alert.operator,
    target_price: alert.target,
    target_price_display_unit: alert.target_price_display_unit || asset?.unit || unitForMarket(alert.market),
    lifecycle_state: state,
    is_active: Boolean(alert.enabled && state === ALERT_LIFECYCLE.ACTIVE),
    cooldown_minutes: Number(alert.cooldown_minutes || 60),
    last_triggered_at: alert.triggered_at || null,
    confirmed_at: alert.confirmed_at || null,
    triggered_at: alert.triggered_at || null,
    delivered_at: alert.delivered_at || null,
    cancelled_at: alert.cancelled_at || null,
    created_at: alert.created_at || null,
    updated_at: alert.updated_at || null,
  };
}

async function listAlertEvents(env, chatId) {
  if (hasProductDb(env)) {
    const rows = await listAlertEventsDb(env, chatId);
    return {
      items: rows.map((row) => ({
        id: row.id,
        alert_id: row.alert_id,
        asset_code: row.asset_code,
        asset_name: row.asset_name,
        status: row.status,
        triggered_price: row.triggered_price,
        triggered_at: row.triggered_at,
        sent_at: row.sent_at,
        error_message: row.error_message,
      })),
    };
  }
  const alerts = await getUserAlerts(env, chatId);
  const items = alerts
    .filter((alert) => alert.triggered_at || alert.delivered_at || alert.error_message)
    .sort((left, right) => String(right.triggered_at || right.delivered_at).localeCompare(String(left.triggered_at || left.delivered_at)))
    .slice(0, 20)
    .map((alert) => ({
      id: alert.trigger_event_id || `event:${alert.id}`,
      alert_id: alert.id,
      asset_code: assetCodeForWorker(alert.symbol, alert.market),
      asset_name: alert.display_asset_name_at_creation || alert.symbol,
      status: alert.error_message ? "failed" : alert.delivered_at ? "sent" : "pending",
      triggered_price: null,
      triggered_at: alert.triggered_at || null,
      sent_at: alert.delivered_at || null,
      error_message: alert.error_message || null,
    }));
  return { items };
}

async function createUserAlert(request, env, chatId) {
  const payload = await request.json();
  const [market, symbol] = normalizeAssetCode(payload.asset_code);
  const asset = market && symbol ? getAssetByMarketSymbol(market, symbol) : null;
  if (!asset) return error(`Asset not found for symbol: ${payload.asset_code}`, 404);

  const target = Number(payload.target_price);
  if (!Number.isFinite(target) || target <= 0) return error("target_price must be positive", 422);
  const operator = String(payload.condition_type || "").toLowerCase();
  if (!["above", "below"].includes(operator)) return error("condition_type must be above or below", 422);

  try {
    const alert = await createAlert(env, chatId, {
      market,
      symbol,
      canonical_asset_id: asset.canonical_asset_id,
      display_asset_name_at_creation: asset.display_name,
      operator,
      target,
      target_price_display_unit: asset.unit,
      cooldown_minutes: Math.max(1, Math.min(Number(payload.cooldown_minutes || 60), 10080)),
    });
    return json(alertOut(alert, chatId), { status: 201 });
  } catch (createError) {
    const status = createError?.code === "MAX_ALERTS_REACHED" ? 409 : 422;
    return error(String(createError?.message || createError), status);
  }
}

async function patchUserAlert(request, env, chatId, alertId) {
  const payload = await request.json();
  if (payload.target_price != null) {
    const target = Number(payload.target_price);
    if (!Number.isFinite(target) || target <= 0) return error("target_price must be positive", 422);
    const alerts = await getUserAlerts(env, chatId);
    const current = alerts.find((alert) => alert.id === alertId);
    const updated = await updateAlertTarget(env, chatId, alertId, target, current?.target_price_display_unit);
    return updated ? json(alertOut(updated, chatId)) : error("Alert not found", 404);
  }
  if (payload.is_active != null) {
    const updated = payload.is_active
      ? await resumeAlert(env, chatId, alertId)
      : await pauseAlert(env, chatId, alertId);
    return updated ? json(alertOut(updated, chatId)) : error("Alert not found or invalid transition", 404);
  }
  return error("No supported fields to update", 422);
}

export async function handleMiniAppApi(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/v1/prices/latest" && request.method === "GET") {
    return json(await latestPrices());
  }

  if (path === "/api/v1/prices/history" && request.method === "GET") {
    const requested = url.searchParams.get("asset_code");
    const [market, symbol] = normalizeAssetCode(requested);
    const asset = market && symbol ? getAssetByMarketSymbol(market, symbol) : null;
    if (!asset) return error("Asset not found", 404);
    if (!hasProductDb(env)) {
      return json({ items: [], data_status: "history_unavailable_without_d1" });
    }
    const rangeDays = { "1d": 1, "7d": 7, "30d": 30, "90d": 30 };
    const days = rangeDays[String(url.searchParams.get("range") || "1d").toLowerCase()] || 1;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = await getPriceHistoryDb(env, asset.canonical_asset_id, since);
    return json({
      items: rows.map((row) => ({
        asset_code: assetCodeForWorker(asset.symbol, asset.market),
        asset_name: asset.display_name,
        price_value: row.price,
        currency_code: asset.market === "crypto" ? "USDT" : "IRT",
        display_unit: row.display_unit,
        provider: row.provider,
        observed_at: row.observed_at,
      })),
      data_status: "real",
    });
  }

  const isAuthenticatedPath =
    path.startsWith("/api/v1/alerts") || path.startsWith("/api/v1/subscription");
  if (!isAuthenticatedPath) return null;

  let user;
  try {
    user = await currentUser(request, env);
  } catch (authError) {
    return error(String(authError?.message || authError), 401);
  }
  const chatId = user.telegram_user_id;

  if (path === "/api/v1/subscription" && request.method === "GET") {
    const entitlement = await getEntitlement(env, chatId);
    const activeAlertCount = hasProductDb(env) ? await getUserAlertCount(env, chatId) : 0;
    return json({
      ...entitlement,
      active_alert_count: activeAlertCount,
      pro_price_toman: PRO_PRICE_TOMAN,
      payment_instructions: env.PAYMENT_INSTRUCTIONS || null,
    });
  }

  if (path === "/api/v1/subscription/payment-requests" && request.method === "POST") {
    if (!hasProductDb(env)) return error("Subscription storage is unavailable", 503);
    const payload = await request.json();
    try {
      const payment = await createPaymentRequest(env, chatId, payload.reference);
      return json({
        ...payment,
        status: "pending",
        amount_toman: PRO_PRICE_TOMAN,
      }, { status: payment.already_pending ? 200 : 201 });
    } catch (paymentError) {
      return error(String(paymentError?.message || paymentError), 422);
    }
  }

  if (path === "/api/v1/alerts" && request.method === "GET") {
    const alerts = await getUserAlerts(env, chatId);
    return json({ items: alerts.map((alert) => alertOut(alert, chatId)) });
  }

  if (path === "/api/v1/alerts" && request.method === "POST") {
    return createUserAlert(request, env, chatId);
  }

  if (path === "/api/v1/alerts/events" && request.method === "GET") {
    return json(await listAlertEvents(env, chatId));
  }

  const alertMatch = path.match(/^\/api\/v1\/alerts\/([^/]+)(?:\/confirm)?$/);
  if (!alertMatch) return error("Not found", 404);
  const alertId = alertMatch[1];

  if (path.endsWith("/confirm") && request.method === "POST") {
    const alerts = await getUserAlerts(env, chatId);
    const alert = alerts.find((item) => item.id === alertId);
    return alert ? json(alertOut(alert, chatId)) : error("Alert not found", 404);
  }

  if (request.method === "PATCH") {
    return patchUserAlert(request, env, chatId, alertId);
  }

  if (request.method === "DELETE") {
    const deleted = await deleteAlert(env, chatId, alertId);
    return deleted ? json({ success: true }) : error("Alert not found", 404);
  }

  return error("Method not allowed", 405);
}
