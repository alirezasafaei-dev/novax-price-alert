import { sendMessage } from "./telegram.js";
import { getCryptoPrices, getIranMarketPrices, formatPrice, unitForMarket } from "./prices.js";
import { logError } from "./log.js";
import { MAIN_KEYBOARD } from "./keyboards.js";

const GREETING_KEYWORDS = [
  "سلام", "درود", "خوبی", "سلاام", "سلامم", "slm", "hi", "hello", "hey",
  "نواکس سلام", "سلام نواکس", "سلام novax",
];
const THANKS_KEYWORDS = [
  "ممنون", "مرسی", "تشکر", "دمت گرم", "دستت درد نکنه", "thx", "thanks", "ty",
];
const HELP_KEYWORDS = [
  "راهنما", "چجوری کار میکنه", "چه کاری میتونی بکنی", "help", "چطور کار میکنه",
  "راهنمایی", "امکانات",
];
const BYE_KEYWORDS = [
  "خداحافظ", "بابای", "فعلا", "بای", "bye", "goodbye",
];
const PRICE_TRIGGERS = [
  "قیمت", "چنده", "چند", "قیمتش", "قیمته", "بگو", "نرخ", "price", "how much",
];
const ALL_PRICE_TRIGGERS = [
  "همه قیمت", "قیمت و بگو", "همه رو بگو", "لیست قیمت", "all prices", "market",
  "گزارش", "بازار چطوره", "اوضاع چطوره",
];
const BOT_NAMES = ["نواکس", "novax", "ربات", "bot", "دستیار"];

const ASSET_ALIASES = {
  "btc": { id: "crypto:BTC", symbol: "BTC", market: "crypto" },
  "بیت کوین": { id: "crypto:BTC", symbol: "BTC", market: "crypto" },
  "بیت‌کوین": { id: "crypto:BTC", symbol: "BTC", market: "crypto" },
  "بیت": { id: "crypto:BTC", symbol: "BTC", market: "crypto" },
  "bitcoin": { id: "crypto:BTC", symbol: "BTC", market: "crypto" },
  "ethereum": { id: "crypto:ETH", symbol: "ETH", market: "crypto" },
  "eth": { id: "crypto:ETH", symbol: "ETH", market: "crypto" },
  "اتریوم": { id: "crypto:ETH", symbol: "ETH", market: "crypto" },
  "اتر": { id: "crypto:ETH", symbol: "ETH", market: "crypto" },
  "solana": { id: "crypto:SOL", symbol: "SOL", market: "crypto" },
  "sol": { id: "crypto:SOL", symbol: "SOL", market: "crypto" },
  "سولانا": { id: "crypto:SOL", symbol: "SOL", market: "crypto" },
  "binance coin": { id: "crypto:BNB", symbol: "BNB", market: "crypto" },
  "bnb": { id: "crypto:BNB", symbol: "BNB", market: "crypto" },
  "بایننس": { id: "crypto:BNB", symbol: "BNB", market: "crypto" },
  "usd": { id: "fiat:USD", symbol: "USD", market: "fiat" },
  "دلار": { id: "fiat:USD", symbol: "USD", market: "fiat" },
  "دلار امریکا": { id: "fiat:USD", symbol: "USD", market: "fiat" },
  "eur": { id: "fiat:EUR", symbol: "EUR", market: "fiat" },
  "euro": { id: "fiat:EUR", symbol: "EUR", market: "fiat" },
  "یورو": { id: "fiat:EUR", symbol: "EUR", market: "fiat" },
  "usdt": { id: "fiat:USDT", symbol: "USDT", market: "fiat" },
  "tether": { id: "fiat:USDT", symbol: "USDT", market: "fiat" },
  "تتر": { id: "fiat:USDT", symbol: "USDT", market: "fiat" },
  "gold_18k": { id: "gold:GOLD_18K", symbol: "GOLD_18K", market: "gold" },
  "geram18": { id: "gold:GOLD_18K", symbol: "GOLD_18K", market: "gold" },
  "طلای ۱۸": { id: "gold:GOLD_18K", symbol: "GOLD_18K", market: "gold" },
  "طلای ۱۸ عیار": { id: "gold:GOLD_18K", symbol: "GOLD_18K", market: "gold" },
  "طلا": { id: "gold:GOLD_18K", symbol: "GOLD_18K", market: "gold" },
  "sekkeh_emami": { id: "gold:SEKKEH_EMAMI", symbol: "SEKKEH_EMAMI", market: "gold" },
  "sekee": { id: "gold:SEKKEH_EMAMI", symbol: "SEKKEH_EMAMI", market: "gold" },
  "سکه": { id: "gold:SEKKEH_EMAMI", symbol: "SEKKEH_EMAMI", market: "gold" },
  "امامی": { id: "gold:SEKKEH_EMAMI", symbol: "SEKKEH_EMAMI", market: "gold" },
  "سکه امامی": { id: "gold:SEKKEH_EMAMI", symbol: "SEKKEH_EMAMI", market: "gold" },
};

const MARKET_GROUP_ALIASES = {
  "کریپتو": "crypto",
  "رمزارز": "crypto",
  "ارز دیجیتال": "crypto",
  "crypto": "crypto",
  "ارز": "fiat",
  "fiat": "fiat",
  "طلا": "gold",
  "gold": "gold",
  "سکه": "gold",
};

function normalizePersianNumbers(str) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const english = "0123456789";
  let result = "";
  for (const ch of str) {
    const pIdx = persian.indexOf(ch);
    const aIdx = arabic.indexOf(ch);
    if (pIdx >= 0) result += english[pIdx];
    else if (aIdx >= 0) result += english[aIdx];
    else result += ch;
  }
  return result;
}

function stripBotNames(text) {
  let cleaned = text.trim().toLowerCase();
  for (const name of BOT_NAMES) {
    const nameLower = name.toLowerCase();
    if (cleaned.startsWith(nameLower + " ")) {
      cleaned = cleaned.slice(nameLower.length).trim();
      break;
    }
    if (cleaned.startsWith(nameLower)) {
      cleaned = cleaned.slice(nameLower.length).trim();
      break;
    }
    if (cleaned.endsWith(" " + nameLower)) {
      cleaned = cleaned.slice(0, -(nameLower.length + 1)).trim();
      break;
    }
  }
  return cleaned;
}

function findMatchingAsset(text) {
  const lower = normalizePersianNumbers(text).toLowerCase();
  for (const [alias, asset] of Object.entries(ASSET_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) {
      return asset;
    }
  }
  return null;
}

function findMarketGroup(text) {
  const lower = text.toLowerCase();
  for (const [alias, market] of Object.entries(MARKET_GROUP_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) {
      return market;
    }
  }
  return null;
}

function hasAnyKeyword(text, keywords) {
  const lower = normalizePersianNumbers(text).toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

function detectIntent(text) {
  const cleaned = stripBotNames(text);
  if (!cleaned) return { intent: "GREETING" };

  if (hasAnyKeyword(cleaned, BYE_KEYWORDS)) return { intent: "BYE" };
  if (hasAnyKeyword(cleaned, THANKS_KEYWORDS)) return { intent: "THANKS" };
  if (hasAnyKeyword(cleaned, HELP_KEYWORDS)) return { intent: "HELP" };
  if (hasAnyKeyword(cleaned, GREETING_KEYWORDS)) return { intent: "GREETING" };

  const hasPriceKeyword = hasAnyKeyword(cleaned, PRICE_TRIGGERS);
  const hasAllPrice = hasAnyKeyword(cleaned, ALL_PRICE_TRIGGERS);
  const matchedAsset = findMatchingAsset(cleaned);
  const matchedMarket = findMarketGroup(cleaned);

  if (hasAllPrice || (hasPriceKeyword && !matchedAsset && !matchedMarket)) {
    return { intent: "PRICE_ALL" };
  }

  if (hasPriceKeyword && matchedAsset) {
    return { intent: "PRICE_SPECIFIC", asset: matchedAsset };
  }

  if (matchedAsset && !hasPriceKeyword) {
    return { intent: "PRICE_SPECIFIC", asset: matchedAsset };
  }

  if (matchedMarket && (hasPriceKeyword || hasAllPrice)) {
    return { intent: "PRICE_MARKET", market: matchedMarket };
  }

  return { intent: "UNKNOWN" };
}

function buildPriceLine(asset, symbol, price) {
  if (price == null) return null;
  const priceFormatted = formatPrice(price, asset.market === "crypto" && price < 100 ? 2 : 0);
  return `${symbol} ${asset.unit || ""}: ${priceFormatted}`;
}

async function buildAllPricesText() {
  let cryptoPrices, iranPrices;
  try {
    [cryptoPrices, iranPrices] = await Promise.all([getCryptoPrices(), getIranMarketPrices()]);
  } catch (error) {
    logError("nlp_price_fetch_failed", { error_message: error?.message });
    throw error;
  }

  let parts = ["📊 قیمت‌های لحظه‌ای"];

  const cryptoAssets = [
    { id: "crypto:BTC", symbol: "₿ بیت‌کوین" },
    { id: "crypto:ETH", symbol: "♦ اتریوم" },
    { id: "crypto:SOL", symbol: "◎ سولانا" },
    { id: "crypto:BNB", symbol: "■ بایننس کوین" },
  ];
  const cryptoLines = cryptoAssets
    .map(a => buildPriceLine({ market: "crypto", unit: "USDT" }, a.symbol, cryptoPrices?.[a.id.split(":")[1]]))
    .filter(Boolean);
  if (cryptoLines.length) parts.push("┄ ₿ رمزارزها ────────\n" + cryptoLines.join("\n"));

  const fiatAssets = [
    { id: "fiat:USD", symbol: "💵 دلار" },
    { id: "fiat:EUR", symbol: "💶 یورو" },
    { id: "fiat:USDT", symbol: "💠 تتر" },
  ];
  const fiatLines = fiatAssets
    .map(a => buildPriceLine({ market: "fiat", unit: "تومان" }, a.symbol, iranPrices?.[a.id.split(":")[1]]))
    .filter(Boolean);
  if (fiatLines.length) parts.push("\n┄ 💰 ارز ───────────\n" + fiatLines.join("\n"));

  const goldAssets = [
    { id: "gold:GOLD_18K", symbol: "🪙 طلای ۱۸ عیار" },
    { id: "gold:SEKKEH_EMAMI", symbol: "🟡 سکه امامی" },
  ];
  const goldLines = goldAssets
    .map(a => buildPriceLine({ market: "gold", unit: "تومان" }, a.symbol, iranPrices?.[a.id.split(":")[1]]))
    .filter(Boolean);
  if (goldLines.length) parts.push("\n┄ 🥇 طلا ───────────\n" + goldLines.join("\n"));

  parts.push("\n⚡️ از /help برای راهنما استفاده کن.");
  return parts.join("\n\n");
}

async function queryGroq(env, message) {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) return null;

  let cryptoPrices, iranPrices;
  try {
    [cryptoPrices, iranPrices] = await Promise.all([
      getCryptoPrices().catch(() => ({})),
      getIranMarketPrices().catch(() => ({})),
    ]);
  } catch {
    cryptoPrices = {};
    iranPrices = {};
  }

  const priceContext = [
    cryptoPrices?.BTC ? `BTC: $${formatPrice(cryptoPrices.BTC)}` : null,
    cryptoPrices?.ETH ? `ETH: $${formatPrice(cryptoPrices.ETH)}` : null,
    iranPrices?.USD ? `USD: ${formatPrice(iranPrices.USD)} تومان` : null,
    iranPrices?.GOLD_18K ? `GOLD: ${formatPrice(iranPrices.GOLD_18K)} تومان` : null,
    iranPrices?.USDT ? `USDT: ${formatPrice(iranPrices.USDT)} تومان` : null,
  ].filter(Boolean).join(", ");

  const systemPrompt = `تو دستیار نواکسی، ربات هوشمند قیمت و هشدار ارزهای دیجیتال و بازار ایران.
قیمت‌های الان: ${priceContext || "نامشخص"}

قوانین:
- پاسخ کوتاه و خودمانی بده (حداکثر ۲-۳ خط)
- اگر کاربر درباره قیمت پرسیده، قیمت رو بگو
- اگر اسم دارایی رو گفت، قیمت همون رو بگو
- فارسی صحبت کن
- سوالات غیرمرتبط رو به مودبانه جواب نده و بگو از /help استفاده کنه`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      logError("groq_api_error", { status: response.status });
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    if (error?.name === "AbortError") {
      logError("groq_api_timeout");
    } else {
      logError("groq_api_failed", { error_message: error?.message });
    }
    return null;
  }
}

export async function handleNLP(env, chatId, text, messageId) {
  if (!text || typeof text !== "string") {
    await sendMessage(env, chatId, "سلام! چطور میتونم کمکت کنم؟ 🙏", { reply_markup: MAIN_KEYBOARD });
    return true;
  }

  const result = detectIntent(text);
  const options = messageId ? { reply_to_message_id: messageId } : {};

  switch (result.intent) {
    case "GREETING": {
      const greetings = [
        "سلام! به نواکس خوش اومدی 🙌 چطور میتونم کمکت کنم؟",
        "درود! نواکس در خدمته 👋 هر سوالی داری بپرس!",
        "سلام سلام! 😊 آماده پاسخگویی هستم!",
      ];
      await sendMessage(env, chatId, greetings[Math.floor(Math.random() * greetings.length)], { ...options, reply_markup: MAIN_KEYBOARD });
      return true;
    }

    case "THANKS": {
      const replies = [
        "خواهش میکنم 🙏 همیشه در خدمتم!",
        "نوش جان 🫡 هر موقع نیاز داشتی بگو!",
        "خوشحالم که تونستم کمک کنم 🤝",
      ];
      await sendMessage(env, chatId, replies[Math.floor(Math.random() * replies.length)]);
      return true;
    }

    case "HELP": {
      await sendMessage(env, chatId, "من میتونم:\n\n💰 قیمت‌های لحظه‌ای بیت‌کوین، اتریوم، سولانا، دلار، تتر، طلا و سکه رو بگم\n🔔 هشدار قیمت تنظیم کنم (وقتی قیمت به یه حدی رسید بهت خبر بدم)\n📋 هشدارهای فعال تو رو نشون بدم\n🌐 داشبورد هوشمند با نمودار و تحلیل\n\nفقط کافیه اسم دارایی و بگی، مثلاً:\n\"طلا چنده؟\"\n\"قیمت بیت کوین\"\n\"نواکس همه قیمت و بگو\"", { ...options, reply_markup: MAIN_KEYBOARD });
      return true;
    }

    case "BYE": {
      await sendMessage(env, chatId, "روز خوبی داشته باشی 👋 هر موقع نیاز داشتی من هستم!", { ...options, reply_markup: MAIN_KEYBOARD });
      return true;
    }

    case "PRICE_SPECIFIC": {
      if (!result.asset) return false;
      try {
        let price;
        if (result.asset.market === "crypto") {
          const prices = await getCryptoPrices();
          price = prices?.[result.asset.symbol];
        } else {
          const prices = await getIranMarketPrices();
          price = prices?.[result.asset.symbol];
        }

        if (price == null) {
          await sendMessage(env, chatId, `متاسفانه نتونستم قیمت ${result.asset.symbol} رو پیدا کنم 😕`, options);
          return true;
        }

        const displayPrice = formatPrice(price, result.asset.market === "crypto" && price < 100 ? 2 : 0);
        const unit = result.asset.market === "crypto" ? "USDT" : "تومان";
        const emojis = { "BTC": "₿", "ETH": "♦", "SOL": "◎", "BNB": "■", "USD": "💵", "EUR": "💶", "USDT": "💠", "GOLD_18K": "🪙", "SEKKEH_EMAMI": "🟡" };
        const emoji = emojis[result.asset.symbol] || "💰";
        const messages = [
          `${emoji} ${result.asset.symbol}: ${displayPrice} ${unit}`,
          `${emoji} ${result.asset.symbol} هم‌اکنون ${displayPrice} ${unit}`,
          `${emoji} قیمت ${result.asset.symbol}: ${displayPrice} ${unit}`,
        ];
        await sendMessage(env, chatId, messages[Math.floor(Math.random() * messages.length)], options);
      } catch {
        await sendMessage(env, chatId, "خطا در دریافت قیمت. لطفاً دوباره تلاش کن 🙏", options);
      }
      return true;
    }

    case "PRICE_MARKET": {
      try {
        if (result.market === "crypto") {
          const prices = await getCryptoPrices();
          const lines = [
            "₿ بیت‌کوین: " + (prices?.BTC != null ? `$${formatPrice(prices.BTC)}` : "نامشخص"),
            "♦ اتریوم: " + (prices?.ETH != null ? `$${formatPrice(prices.ETH)}` : "نامشخص"),
            "◎ سولانا: " + (prices?.SOL != null ? `$${formatPrice(prices.SOL)}` : "نامشخص"),
          ];
          await sendMessage(env, chatId, "📊 قیمت رمزارزها:\n\n" + lines.join("\n"), options);
        } else if (result.market === "fiat") {
          const prices = await getIranMarketPrices();
          const lines = [
            "💵 دلار: " + (prices?.USD != null ? `${formatPrice(prices.USD)} تومان` : "نامشخص"),
            "💶 یورو: " + (prices?.EUR != null ? `${formatPrice(prices.EUR)} تومان` : "نامشخص"),
            "💠 تتر: " + (prices?.USDT != null ? `${formatPrice(prices.USDT)} تومان` : "نامشخص"),
          ];
          await sendMessage(env, chatId, "💰 قیمت ارزها:\n\n" + lines.join("\n"), options);
        } else if (result.market === "gold") {
          const prices = await getIranMarketPrices();
          const lines = [
            "🪙 طلای ۱۸ عیار: " + (prices?.GOLD_18K != null ? `${formatPrice(prices.GOLD_18K)} تومان` : "نامشخص"),
            "🟡 سکه امامی: " + (prices?.SEKKEH_EMAMI != null ? `${formatPrice(prices.SEKKEH_EMAMI)} تومان` : "نامشخص"),
          ];
          await sendMessage(env, chatId, "🥇 قیمت طلا و سکه:\n\n" + lines.join("\n"), options);
        }
      } catch {
        await sendMessage(env, chatId, "خطا در دریافت قیمت. لطفاً دوباره تلاش کن 🙏", options);
      }
      return true;
    }

    case "PRICE_ALL": {
      try {
        const text = await buildAllPricesText();
        await sendMessage(env, chatId, text, options);
      } catch {
        await sendMessage(env, chatId, "خطا در دریافت قیمت‌ها. لطفاً دوباره تلاش کن 🙏", options);
      }
      return true;
    }

    case "UNKNOWN":
    default: {
      const groqResponse = await queryGroq(env, text);
      if (groqResponse) {
        await sendMessage(env, chatId, groqResponse, options);
        return true;
      }
      return false;
    }
  }
}
