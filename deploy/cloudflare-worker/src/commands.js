import { FAQ_KEYBOARD, GROWTH_KEYBOARD, MAIN_KEYBOARD, MARKET_KEYBOARD, alertActionsKeyboard, miniAppKeyboard } from "./keyboards.js";
import { sendMessage } from "./telegram.js";
import { setUser, clearSession } from "./sessions.js";
import { handleNLP } from "./nlp.js";
import {
  getCryptoPrices,
  getIranMarketPrices,
  formatPrice,
  unitForMarket,
} from "./prices.js";
import { getUserAlerts, formatAlertLine } from "./alerts.js";
import { logError, logEvent } from "./log.js";
import { recordMetric } from "./metrics.js";
import { upsertUser } from "./product-db.js";
import { isReferralSource, referralInfoText, getReferralLink } from "./growth.js";

export async function handleStart(env, chatId, from, startParam) {
  logEvent("bot_started", { user_id: String(chatId), start_param: startParam || null });
  recordMetric(env, "bot_started", {});
  if (from) {
    await setUser(env, chatId, {
      chat_id: chatId,
      username: from.username || null,
      first_name: from.first_name || null,
      created_at: new Date().toISOString(),
    });
    await upsertUser(env, {
      telegram_user_id: chatId,
      username: from.username,
      first_name: from.first_name,
      last_name: from.last_name,
      language_code: from.language_code,
    });
  }
  
  await clearSession(env, chatId);
  
  let text = `سلام ${from?.first_name || ""}! 👋

به بات هشدار قیمت نواکس خوش اومدی.

با این بات می‌تونی:
💰 آخرین قیمت‌های دریافت‌شده رو ببینی
🔔 هشدار قیمت تنظیم کنی
📋 هشدارهات رو مدیریت کنی
🌐 داشبورد هوشمند رو باز کنی
از «تنظیم هشدار» شروع کن. بررسی هشدارها دوره‌ای است و ممکن است عبور کوتاه‌مدت از قیمت هدف ثبت نشود.`;
  
  await sendMessage(env, chatId, text, { reply_markup: MAIN_KEYBOARD });
  if (env.NOVAX_MINI_APP_URL || env.MINI_APP_URL) {
    await sendMessage(env, chatId, "برای تجربه داشبورد داخل تلگرام:", {
      reply_markup: miniAppKeyboard(env),
    });
  }
}

export async function handleHelp(env, chatId) {
  logEvent("command_used", { user_id: String(chatId), command: "help" });
  recordMetric(env, "command_used", { asset: "help" });
  const text = `❓ راهنمای استفاده:

💰 قیمت‌ها: مشاهده آخرین قیمت‌های دریافت‌شده کریپتو، ارز و طلا

🔔 تنظیم هشدار: ساخت هشدار قیمت در ۶ مرحله (بازار → دارایی → قیمت فعلی → شرط → قیمت هدف → تایید)

📋 هشدارهای من: مشاهده، ویرایش، توقف/ادامه، تکرار و حذف هشدارها با دکمه‌های داخل هر کارت

🎁 دعوت دوستان: لینک دعوت خودت رو از «📋 هشدارهای من» بگیر. هر ۳ دعوت موفق = ۷ روز Pro رایگان!

❓ سوالات پرتکرار: /faq
🌐 داشبورد هوشمند: باز کردن مینی‌اپ داخل تلگرام

نسخه رایگان تا ۳ هشدار و Pro تا ۳۰ هشدار دارد. زمان‌بندی فعلی بررسی دوره‌ای است (حدود یک ساعت طبق تنظیمات سرویس)؛ هنگام اختلال منبع قیمت ممکن است بررسی به تعویق بیفتد. خرید جدید Pro تا پایان بازبینی سرویس متوقف است.`;
  
  await sendMessage(env, chatId, text, { reply_markup: MAIN_KEYBOARD });
}

export async function handleMiniAppMenu(env, chatId) {
  logEvent("mini_app_opened", { user_id: String(chatId) });
  recordMetric(env, "mini_app_opened", {});
  if (env.NOVAX_MINI_APP_URL || env.MINI_APP_URL) {
    await sendMessage(env, chatId, "🌐 داشبورد هوشمند نواکس را از دکمه زیر باز کن:", {
      reply_markup: miniAppKeyboard(env),
    });
    return;
  }
  await sendMessage(env, chatId, "فعلاً آدرس داشبورد هوشمند روی Worker تنظیم نشده است.", { reply_markup: MAIN_KEYBOARD });
}

export async function handleFaq(env, chatId) {
  const text = `❓ سوالات پرتکرار

موضوع موردنظرت را انتخاب کن.`;
  await sendMessage(env, chatId, text, { reply_markup: FAQ_KEYBOARD });
}

export async function handleGrowthMenu(env, chatId) {
  const text = `❓ راهنما و سوالات پرتکرار

از این بخش می‌توانی سوالات پرتکرار را ببینی.`;
  await sendMessage(env, chatId, text, { reply_markup: GROWTH_KEYBOARD });
}

export async function handlePricesMenu(env, chatId) {
  logEvent("command_used", { user_id: String(chatId), command: "prices" });
  recordMetric(env, "command_used", { asset: "prices" });
  const text = "کدوم بازار رو می‌خوای ببینی؟";
  await sendMessage(env, chatId, text, { reply_markup: MARKET_KEYBOARD });
}

export async function handleMyAlerts(env, chatId) {
  logEvent("command_used", { user_id: String(chatId), command: "my_alerts" });
  recordMetric(env, "command_used", { asset: "my_alerts" });
  const alerts = await getUserAlerts(env, chatId);

  if (alerts.length === 0) {
    await sendMessage(env, chatId, "هنوز هشدار فعالی نداری.\n\nبرای ساخت هشدار از «🔔 تنظیم هشدار» استفاده کن.", { reply_markup: MAIN_KEYBOARD });
    return;
  }

  let cryptoPrices = null;
  let iranPrices = null;
  try {
    [cryptoPrices, iranPrices] = await Promise.all([getCryptoPrices(), getIranMarketPrices()]);
  } catch (error) {
    logError("alerts_list_price_load_failed", { error_message: error?.message });
  }

  // Group by asset for better UX (My Assets style summary in chat)
  const byAsset = {};
  alerts.forEach(a => {
    const key = a.canonical_asset_id || `${a.market}:${a.symbol}`;
    if (!byAsset[key]) byAsset[key] = { name: a.display_asset_name_at_creation || a.symbol, alerts: [], market: a.market, symbol: a.symbol };
    byAsset[key].alerts.push(a);
  });

  const assetNames = Object.keys(byAsset).map(k => byAsset[k].name).join("، ");
  await sendMessage(env, chatId, `📁 دارایی‌های شما با هشدار فعال: ${assetNames}\n\nجزئیات:`, { reply_markup: MAIN_KEYBOARD });

  // Send per-asset summary in chat.
  const assetKeys = Object.keys(byAsset);
  for (const key of assetKeys.slice(0, 5)) {  // limit for chat
    const item = byAsset[key];
    const current = item.market === "crypto" ? cryptoPrices?.[item.symbol] : iranPrices?.[item.symbol];
    let cur = current != null ? `${formatPrice(current, item.market==="crypto" && current<100 ? 2 : 0)} ${unitForMarket(item.market)}` : "نامشخص";
    const msg = `• ${item.name}\n  قیمت فعلی: ${cur}\n  تعداد هشدار: ${item.alerts.length}\n\nبرای مدیریت، از دکمه‌های همین چت استفاده کنید.`;
    await sendMessage(env, chatId, msg, { reply_markup: MAIN_KEYBOARD });
  }

  if (assetKeys.length > 5) {
    await sendMessage(env, chatId, `... و ${assetKeys.length - 5} دارایی دیگر.`, { reply_markup: MAIN_KEYBOARD });
  }

  for (const [index, alert] of alerts.slice(0, 10).entries()) {
    const current = alert.market === "crypto" ? cryptoPrices?.[alert.symbol] : iranPrices?.[alert.symbol];
    const currentPriceText = current != null ? `${formatPrice(current, alert.market==="crypto" && current<100 ? 2 : 0)} ${unitForMarket(alert.market)}` : "نامشخص";
    await sendMessage(env, chatId, formatAlertLine(alert, index, currentPriceText), {
      reply_markup: alertActionsKeyboard(alert.id),
    });
  }

  await sendMessage(env, chatId, "مدیریت هشدارها از دکمه‌های همین چت انجام می‌شود.", { reply_markup: MAIN_KEYBOARD });
}

export async function handleCreateAlertStart(env, chatId) {
  const text = "کدوم بازار رو می‌خوای براش هشدار بسازی؟";
  await sendMessage(env, chatId, text, { reply_markup: MARKET_KEYBOARD });
}

export async function handleUnknownMessage(env, chatId, text, messageId) {
  const handled = await handleNLP(env, chatId, text, messageId);
  if (!handled) {
    await sendMessage(env, chatId, "متوجه نشدم 😕 می‌تونی سوالتو واضح‌تر بپرسی یا از /help استفاده کنی.", { reply_markup: MAIN_KEYBOARD, reply_to_message_id: messageId });
  }
}

export async function handleInlineQuery(env, inlineQuery) {
  const queryId = inlineQuery.id;
  const query = (inlineQuery.query || '').trim().toLowerCase();
  const userId = inlineQuery.from?.id;

  let cryptoPrices, iranPrices;
  try {
    [cryptoPrices, iranPrices] = await Promise.all([getCryptoPrices(), getIranMarketPrices()]);
  } catch {
    // proceed with empty prices
  }

  const results = [];

  if (query) {
    // Specific asset lookup
    const matchedAsset = Object.entries({
      btc: { title: '₿ بیت‌کوین', price: cryptoPrices?.BTC, unit: 'USDT', dec: 2 },
      bitcoin: { title: '₿ بیت‌کوین', price: cryptoPrices?.BTC, unit: 'USDT', dec: 2 },
      eth: { title: '♦ اتریوم', price: cryptoPrices?.ETH, unit: 'USDT', dec: 2 },
      ethereum: { title: '♦ اتریوم', price: cryptoPrices?.ETH, unit: 'USDT', dec: 2 },
      sol: { title: '◎ سولانا', price: cryptoPrices?.SOL, unit: 'USDT', dec: 2 },
      solana: { title: '◎ سولانا', price: cryptoPrices?.SOL, unit: 'USDT', dec: 2 },
      bnb: { title: '■ بایننس', price: cryptoPrices?.BNB, unit: 'USDT', dec: 2 },
      usd: { title: '💵 دلار', price: iranPrices?.USD, unit: 'تومان', dec: 0 },
      dollar: { title: '💵 دلار', price: iranPrices?.USD, unit: 'تومان', dec: 0 },
      دلار: { title: '💵 دلار', price: iranPrices?.USD, unit: 'تومان', dec: 0 },
      eur: { title: '💶 یورو', price: iranPrices?.EUR, unit: 'تومان', dec: 0 },
      یورو: { title: '💶 یورو', price: iranPrices?.EUR, unit: 'تومان', dec: 0 },
      usdt: { title: '💠 تتر', price: iranPrices?.USDT, unit: 'تومان', dec: 0 },
      تتر: { title: '💠 تتر', price: iranPrices?.USDT, unit: 'تومان', dec: 0 },
      طلا: { title: '🪙 طلای ۱۸ عیار', price: iranPrices?.GOLD_18K, unit: 'تومان', dec: 0 },
      gold: { title: '🪙 طلای ۱۸ عیار', price: iranPrices?.GOLD_18K, unit: 'تومان', dec: 0 },
      سکه: { title: '🟡 سکه امامی', price: iranPrices?.SEKKEH_EMAMI, unit: 'تومان', dec: 0 },
    }).find(([key]) => query.includes(key));

    if (matchedAsset) {
      const [, info] = matchedAsset;
      const priceStr = info.price != null
        ? formatPrice(info.price, info.dec) + ' ' + info.unit
        : 'نامشخص';
      results.push({
        type: 'article',
        id: 'price_1',
        title: `${info.title}: ${priceStr}`,
        description: 'قیمت لحظه‌ای از نواکس',
        input_message_content: {
          message_text: `${info.title}: ${priceStr}\n\n🤖 @novax_price_bot`,
        },
      });
    }
  }

  // Always include "all prices" option
  const btcPrice = cryptoPrices?.BTC != null ? '$' + formatPrice(cryptoPrices.BTC, cryptoPrices.BTC < 100 ? 2 : 0) : '?';
  const usdPrice = iranPrices?.USD != null ? formatPrice(iranPrices.USD) + ' تومان' : '?';
  const goldPrice = iranPrices?.GOLD_18K != null ? formatPrice(iranPrices.GOLD_18K) + ' تومان' : '?';

  results.unshift({
    type: 'article',
    id: 'all_prices',
    title: `📊 بیت‌کوین ${btcPrice} | دلار ${usdPrice} | طلا ${goldPrice}`,
    description: 'نمایش همه قیمت‌های لحظه‌ای',
    input_message_content: {
      message_text: `📊 قیمت‌های لحظه‌ای نواکس\n\n₿ بیت‌کوین: ${btcPrice}\n♦ اتریوم: ${cryptoPrices?.ETH != null ? '$' + formatPrice(cryptoPrices.ETH) : '?'}\n💵 دلار: ${usdPrice}\n💠 تتر: ${iranPrices?.USDT != null ? formatPrice(iranPrices.USDT) + ' تومان' : '?'}\n🪙 طلای ۱۸ عیار: ${goldPrice}\n🟡 سکه امامی: ${iranPrices?.SEKKEH_EMAMI != null ? formatPrice(iranPrices.SEKKEH_EMAMI) + ' تومان' : '?'}\n\n🤖 @novax_price_bot | بات هوشمند هشدار قیمت`,
    },
  });

  if (results.length === 0) {
    results.push({
      type: 'article',
      id: 'help',
      title: 'ℹ️ اسم دارایی رو بنویس',
      description: 'مثلاً: btc, eth, طلا, دلار, تتر, سکه',
      input_message_content: {
        message_text: '💰 اسم دارایی مورد نظرت رو تایپ کن، مثلاً:\nbtc\neth\nطلا\nدلار\nتتر\nسکه\n\n🤖 @novax_price_bot',
      },
    });
  }

  await telegramApi(env, 'answerInlineQuery', {
    inline_query_id: queryId,
    results,
    cache_time: 60,
    is_personal: true,
  });
}
