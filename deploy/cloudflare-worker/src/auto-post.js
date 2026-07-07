import { getCryptoPrices, getIranMarketPrices, formatPrice } from "./prices.js";
import { sendMessage } from "./telegram.js";
import { logEvent, logError } from "./log.js";

function getTehranDateHour(now) {
  const d = now || new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return {
    date: `${get("year")}${get("month")}${get("day")}`,
    hour: Number(get("hour")),
  };
}

function getConfiguredHours(env) {
  const raw = String(env.AUTO_POST_HOURS || "10,14,20").trim();
  return raw.split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h <= 23);
}

function getAutoPostKvKey(chatId, date, hour) {
  return `auto_post:${chatId}:${date}:${hour}`;
}

export async function shouldAutoPost(env, now) {
  const enabled = String(env.AUTO_POST_ENABLED || "false").toLowerCase() === "true";
  if (!enabled) return false;

  const chatId = env.AUTO_POST_CHAT_ID;
  if (!chatId) return false;

  const { date, hour } = getTehranDateHour(now);
  const configuredHours = getConfiguredHours(env);
  if (!configuredHours.includes(hour)) return false;

  const kvKey = getAutoPostKvKey(chatId, date, hour);
  const alreadyPosted = await env.AUTO_POST_KV?.get(kvKey);
  if (alreadyPosted) return false;

  return { chatId, kvKey, date, hour };
}

export async function sendAutoPost(env, now) {
  const check = await shouldAutoPost(env, now);
  if (!check) return false;

  let cryptoPrices, iranPrices;
  try {
    [cryptoPrices, iranPrices] = await Promise.all([getCryptoPrices(), getIranMarketPrices()]);
  } catch (error) {
    logError("autopost_price_fetch_failed", { error_message: error?.message });
    return false;
  }

  const btc = cryptoPrices?.BTC != null ? `$${formatPrice(cryptoPrices.BTC, cryptoPrices.BTC < 100 ? 2 : 0)}` : "نامشخص";
  const eth = cryptoPrices?.ETH != null ? `$${formatPrice(cryptoPrices.ETH, cryptoPrices.ETH < 100 ? 2 : 0)}` : "نامشخص";
  const usd = iranPrices?.USD != null ? `${formatPrice(iranPrices.USD)} تومان` : "نامشخص";
  const gold = iranPrices?.GOLD_18K != null ? `${formatPrice(iranPrices.GOLD_18K)} تومان` : "نامشخص";
  const tether = iranPrices?.USDT != null ? `${formatPrice(iranPrices.USDT)} تومان` : "نامشخص";
  const sekkeh = iranPrices?.SEKKEH_EMAMI != null ? `${formatPrice(iranPrices.SEKKEH_EMAMI)} تومان` : "نامشخص";
  const sol = cryptoPrices?.SOL != null ? `$${formatPrice(cryptoPrices.SOL, cryptoPrices.SOL < 100 ? 2 : 0)}` : "نامشخص";

  const botUsername = env.BOT_USERNAME || "";
  const cta = botUsername ? `t.me/${botUsername}` : "نواکس";

  const { date } = check;
  const dateStr = `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;

  const text = `📊 گزارش قیمت‌های نواکس
📅 ${dateStr}
─────────────────
₿ بیت‌کوین: ${btc}
♦ اتریوم: ${eth}
◎ سولانا: ${sol}
💵 دلار: ${usd}
💠 تتر: ${tether}
🪙 طلای ۱۸ عیار: ${gold}
🟡 سکه امامی: ${sekkeh}
─────────────────
🚀 ${cta} | بات هوشمند هشدار قیمت
⚡️ هر تغییری،第一时间 بهت خبر میده!`;

  try {
    await sendMessage(env, check.chatId, text);
    if (env.AUTO_POST_KV) {
      await env.AUTO_POST_KV.put(check.kvKey, "1", { expirationTtl: 86400 });
    }
    logEvent("auto_post_sent", { chat_id: check.chatId, date: check.date, hour: check.hour });
    return true;
  } catch (error) {
    logError("auto_post_failed", { error_message: error?.message, chat_id: check.chatId });
    return false;
  }
}
