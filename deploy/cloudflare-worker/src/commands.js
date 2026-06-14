import { MAIN_KEYBOARD, MARKET_KEYBOARD, alertActionsKeyboard } from "./keyboards.js";
import { sendMessage } from "./telegram.js";
import { setUser, clearSession } from "./sessions.js";
import {
  getCryptoPrices,
  getIranMarketPrices,
  formatPrice,
  unitForMarket,
} from "./prices.js";
import { getUserAlerts, formatAlertLine } from "./alerts.js";
import { logError } from "./log.js";

export async function handleStart(env, chatId, from) {
  if (from) {
    await setUser(env, chatId, {
      chat_id: chatId,
      username: from.username || null,
      first_name: from.first_name || null,
      created_at: new Date().toISOString(),
    });
  }
  
  await clearSession(env, chatId);
  
  const text = `سلام ${from?.first_name || ""}! 👋

به بات هشدار قیمت نواکس خوش اومدی.

با این بات می‌تونی:
💰 قیمت‌های لحظه‌ای رو ببینی
🔔 هشدار قیمت تنظیم کنی
📋 هشدارهات رو مدیریت کنی

از منوی زیر شروع کن:`;
  
  await sendMessage(env, chatId, text, { reply_markup: MAIN_KEYBOARD });
}

export async function handleHelp(env, chatId) {
  const text = `❓ راهنمای استفاده:

💰 قیمت‌ها: مشاهده قیمت‌های لحظه‌ای کریپتو (BTC/ETH/BNB از CoinGecko با Binance fallback)، ارز و طلا (از TGJU)

🔔 تنظیم هشدار: ساخت هشدار قیمت در ۵ مرحله (بازار → دارایی → شرط → قیمت هدف → تایید)

📋 هشدارهای من: مشاهده، ویرایش، توقف/ادامه، تکرار و حذف هشدارها با دکمه‌های داخل هر کارت

هشدارها هر ۱۰ دقیقه بررسی می‌شوند و هر هشدار فقط یک بار ارسال می‌شود.`;
  
  await sendMessage(env, chatId, text, { reply_markup: MAIN_KEYBOARD });
}

export async function handlePricesMenu(env, chatId) {
  const text = "کدوم بازار رو می‌خوای ببینی؟";
  await sendMessage(env, chatId, text, { reply_markup: MARKET_KEYBOARD });
}

export async function handleMyAlerts(env, chatId) {
  const alerts = await getUserAlerts(env, chatId);

  if (alerts.length === 0) {
    await sendMessage(env, chatId, "هنوز هشدار فعالی نداری.\n\nبرای ساخت هشدار از «🔔 تنظیم هشدار» یا دکمه وب‌اپ استفاده کن.", { reply_markup: MAIN_KEYBOARD });
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

  // Send per-asset summary + quick TWA link
  const assetKeys = Object.keys(byAsset);
  for (const key of assetKeys.slice(0, 5)) {  // limit for chat
    const item = byAsset[key];
    const current = item.market === "crypto" ? cryptoPrices?.[item.symbol] : iranPrices?.[item.symbol];
    let cur = current != null ? `${formatPrice(current, item.market==="crypto" && current<100 ? 2 : 0)} ${unitForMarket(item.market)}` : "نامشخص";
    const msg = `• ${item.name}\n  قیمت فعلی: ${cur}\n  تعداد هشدار: ${item.alerts.length}\n\nبرای مدیریت کامل و چارت، از دکمه وب‌اپ استفاده کنید.`;
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

  // Encourage rich UI
  await sendMessage(env, chatId, "برای تجربه کامل (چارت پیشرفته، پیشنهادهای هوشمند، دارایی‌های من) از دکمه «🌐 داشبورد هوشمند» استفاده کنید.", { reply_markup: MAIN_KEYBOARD });
}

export async function handleCreateAlertStart(env, chatId) {
  const text = "کدوم بازار رو می‌خوای براش هشدار بسازی؟";
  await sendMessage(env, chatId, text, { reply_markup: MARKET_KEYBOARD });
}

export async function handleUnknownMessage(env, chatId) {
  const text = "دستور نامعتبره. از منوی زیر استفاده کن یا /help رو بزن.";
  await sendMessage(env, chatId, text, { reply_markup: MAIN_KEYBOARD });
}
