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

💰 قیمت‌ها: مشاهده قیمت‌های لحظه‌ای کریپتو (BTC/ETH/SOL/BNB از Binance)، ارز و طلا (از TGJU)

🔔 تنظیم هشدار: ساخت هشدار قیمت در ۵ مرحله (بازار → دارایی → شرط → قیمت هدف → تایید)

📋 هشدارهای من: مشاهده هشدارها و حذف آن‌ها با دکمه‌ی 🗑

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

  await sendMessage(env, chatId, "📋 هشدارهای فعال شما:", { reply_markup: MAIN_KEYBOARD });

  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    const current = alert.market === "crypto"
      ? cryptoPrices?.[alert.symbol]
      : iranPrices?.[alert.symbol];

    let currentText = null;
    if (current !== undefined && current !== null) {
      const decimals = alert.market === "crypto" && current < 100 ? 2 : 0;
      currentText = `${formatPrice(current, decimals)} ${unitForMarket(alert.market)}`;
    }

    const line = formatAlertLine(alert, i, currentText);
    const status = alert.triggered_at ? "\n   وضعیت: ✅ ارسال‌شده" : "";
    await sendMessage(env, chatId, line + status, { reply_markup: alertActionsKeyboard(alert.id) });
  }
}

export async function handleCreateAlertStart(env, chatId) {
  const text = "کدوم بازار رو می‌خوای براش هشدار بسازی؟";
  await sendMessage(env, chatId, text, { reply_markup: MARKET_KEYBOARD });
}

export async function handleUnknownMessage(env, chatId) {
  const text = "دستور نامعتبره. از منوی زیر استفاده کن یا /help رو بزن.";
  await sendMessage(env, chatId, text, { reply_markup: MAIN_KEYBOARD });
}
