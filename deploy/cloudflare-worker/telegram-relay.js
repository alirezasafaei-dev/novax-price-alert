const HELP_TEXT = `سلام، نواکس فعاله ✅

دستورهای فعلی:
/start - شروع و معرفی ربات
/help - راهنما
/prices - نمایش قیمت‌های لحظه‌ای بازار ایران

هشدار قیمت از طریق مینی‌اپ/بک‌اند نواکس مدیریت می‌شود.`;

const TGJU_ASSETS = [
  { symbol: "USD_IRT", label: "دلار آزاد", path: "/profile/price_dollar_rl", profile: true },
  { symbol: "GOLD_18K_IRT", label: "طلای ۱۸ عیار", path: "/profile/geram18", profile: true },
  { symbol: "SEKKEH_EMAMI_IRT", label: "سکه امامی", path: "/profile/sekee", profile: true },
  { symbol: "USDT_IRT", label: "تتر", path: "/", usdt: true },
];

function json(data, init = {}) {
  return Response.json(data, init);
}

function requireRelaySecret(request, env) {
  const expectedSecret = env.RELAY_SECRET || "";
  if (!expectedSecret) return null;
  const receivedSecret = request.headers.get("X-Relay-Secret") || "";
  if (receivedSecret !== expectedSecret) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function getTelegramToken(env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("telegram token is not configured");
  }
  return token;
}

async function telegramApi(env, method, payload) {
  const token = getTelegramToken(env);
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  return { response, result };
}

async function sendMessage(env, payload) {
  return telegramApi(env, "sendMessage", {
    chat_id: payload.chat_id,
    text: payload.text,
    parse_mode: payload.parse_mode || undefined,
    reply_markup: payload.reply_markup || undefined,
    disable_web_page_preview: true,
  });
}

function getMessageText(update) {
  return update?.message?.text || update?.edited_message?.text || "";
}

function getChatId(update) {
  return update?.message?.chat?.id || update?.edited_message?.chat?.id || null;
}

function extractPrice(asset, html) {
  const pattern = asset.usdt
    ? /id="l-crypto-tether-irr"[\s\S]*?<span class="info-price">(?<price>[0-9,]+(?:\.[0-9]+)?)<\/span>/
    : /<span class="price" data-col="info\.last_trade\.PDrCotVal">(?<price>[0-9,]+(?:\.[0-9]+)?)<\/span>/;
  const match = html.match(pattern);
  if (!match?.groups?.price) {
    throw new Error(`TGJU price not found for ${asset.symbol}`);
  }
  return Number(match.groups.price.replaceAll(",", ""));
}

function formatTomanFromRial(value) {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(value / 10);
}

function formatTehranTime(date) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function fetchTgjuPrice(asset, env) {
  const baseUrl = (env.TGJU_BASE_URL || "https://www.tgju.org").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  let response;
  try {
    response = await fetch(`${baseUrl}${asset.path}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NovaxPriceBot/1.0)" },
      cf: { cacheTtl: 30, cacheEverything: false },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`TGJU HTTP ${response.status} for ${asset.symbol}`);
  }
  const html = await response.text();
  return extractPrice(asset, html);
}

async function buildPricesText(env) {
  const now = new Date();
  const lines = ["💰 قیمت‌های لحظه‌ای بازار ایران", "منبع: TGJU", ""];
  const results = await Promise.allSettled(
    TGJU_ASSETS.map(async (asset) => ({ ...asset, price: await fetchTgjuPrice(asset, env) })),
  );
  let okCount = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      okCount += 1;
      lines.push(`${result.value.label}: ${formatTomanFromRial(result.value.price)} تومان`);
    }
  }
  if (okCount === 0) {
    throw new Error("all TGJU price fetches failed");
  }
  lines.push("");
  lines.push(`به‌روزرسانی: ${formatTehranTime(now)} به وقت تهران`);
  if (okCount < TGJU_ASSETS.length) {
    lines.push("برخی قیمت‌ها موقتاً در دسترس نبودند؛ چند لحظه بعد دوباره /prices را بزن.");
  }
  return lines.join("\n");
}

async function sendPricesLater(env, chatId) {
  try {
    const reply = await buildPricesText(env);
    await sendMessage(env, { chat_id: chatId, text: reply });
  } catch (error) {
    await sendMessage(env, {
      chat_id: chatId,
      text: "فعلاً دریافت قیمت‌ها از منبع بازار کند یا ناموفق بود. چند لحظه بعد دوباره /prices را بزن.",
    });
  }
}

async function handleTelegramWebhook(request, env, ctx) {
  const update = await request.json();
  const chatId = getChatId(update);
  if (!chatId) return json({ ok: true, ignored: true });

  const text = getMessageText(update).trim();
  let reply = HELP_TEXT;
  if (text.startsWith("/prices")) {
    await sendMessage(env, { chat_id: chatId, text: "⏳ در حال دریافت قیمت‌های لحظه‌ای..." });
    if (ctx?.waitUntil) {
      ctx.waitUntil(sendPricesLater(env, chatId));
    } else {
      await sendPricesLater(env, chatId);
    }
    return json({ ok: true, queued: "prices" });
  } else if (text && !text.startsWith("/start") && !text.startsWith("/help")) {
    reply = "دستور نامعتبره. /help رو بزن.";
  }

  const { response, result } = await sendMessage(env, { chat_id: chatId, text: reply });
  return json({ ok: response.ok, telegram: result }, { status: response.ok ? 200 : 502 });
}

async function setWebhook(request, env) {
  const unauthorized = requireRelaySecret(request, env);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/webhook`;
  const { response, result } = await telegramApi(env, "setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: false,
  });
  return json({ ok: response.ok, webhook_url: webhookUrl, telegram: result }, {
    status: response.ok ? 200 : 502,
  });
}

async function getWebhookInfo(request, env) {
  const unauthorized = requireRelaySecret(request, env);
  if (unauthorized) return unauthorized;

  const { response, result } = await telegramApi(env, "getWebhookInfo", {});
  return json({ ok: response.ok, telegram: result }, { status: response.ok ? 200 : 502 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") {
        return json({ status: "ok", service: "telegram-relay" });
      }
      if (url.pathname === "/webhook" && request.method === "POST") {
        return handleTelegramWebhook(request, env, ctx);
      }
      if (url.pathname === "/set-webhook" && request.method === "POST") {
        return setWebhook(request, env);
      }
      if (url.pathname === "/webhook-info") {
        return getWebhookInfo(request, env);
      }
      if (url.pathname === "/send" && request.method === "POST") {
        const unauthorized = requireRelaySecret(request, env);
        if (unauthorized) return unauthorized;
        const body = await request.json();
        const { response, result } = await sendMessage(env, body);
        return json(result, { status: response.status });
      }
      return json({ error: "not found" }, { status: 404 });
    } catch (error) {
      return json({ error: error.message || "internal error" }, { status: 500 });
    }
  },
};
