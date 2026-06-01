import { CRYPTO_ASSETS, FIAT_ASSETS, GOLD_ASSETS, OPERATOR_KEYBOARD, confirmAlertKeyboard } from "./keyboards.js";
import { editMessageText, answerCallbackQuery, sendMessage } from "./telegram.js";
import { getSession, setSession, clearSession } from "./sessions.js";
import { createAlert, deleteAlert, formatAlertConfirmation, getUserAlerts } from "./alerts.js";
import { getCryptoPrices, getIranMarketPrices, formatPrice, formatCryptoPricesMessage, formatIranMarketPricesMessage } from "./prices.js";
import { handleStart, handleShowCryptoPrices, handleShowIranPrices, handleMyAlerts, handleCreateAlertStart } from "./commands.js";

export async function handleCallback(env, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data || callbackQuery.callback_data;
  
  if (!data) {
    console.error("No callback_data found:", JSON.stringify(callbackQuery));
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }
  
  await answerCallbackQuery(env, callbackQuery.id);
  
  if (data === "menu:main") {
    await handleStart(env, chatId, callbackQuery.from);
    return;
  }
  
  if (data.startsWith("market:")) {
    const market = data.split(":")[1];
    const session = await getSession(env, chatId);
    
    if (session?.flow === "create_alert") {
      await setSession(env, chatId, { flow: "create_alert", step: "select_asset", market });
      
      let keyboard;
      let text;
      
      if (market === "crypto") {
        keyboard = CRYPTO_ASSETS;
        text = "کدوم ارز دیجیتال رو می‌خوای؟";
      } else if (market === "fiat") {
        keyboard = FIAT_ASSETS;
        text = "کدوم ارز رو می‌خوای؟";
      } else if (market === "gold") {
        keyboard = GOLD_ASSETS;
        text = "کدوم دارایی رو می‌خوای؟";
      } else {
        await editMessageText(env, chatId, messageId, "بازار نامعتبر.");
        return;
      }
      
      await editMessageText(env, chatId, messageId, text, { reply_markup: keyboard });
    } else {
      // مشاهده قیمت‌ها (بدون session)
      await editMessageText(env, chatId, messageId, "⏳ در حال دریافت قیمت‌ها...");
      
      if (market === "crypto") {
        const prices = await getCryptoPrices();
        const text = formatCryptoPricesMessage(prices);
        await sendMessage(env, chatId, text);
      } else if (market === "fiat") {
        const prices = await getIranMarketPrices();
        const text = formatIranMarketPricesMessage(prices);
        await sendMessage(env, chatId, text);
      } else if (market === "gold") {
        const prices = await getIranMarketPrices();
        const text = formatIranMarketPricesMessage(prices);
        await sendMessage(env, chatId, text);
      }
    }
    return;
  }
  
  if (data.startsWith("asset:")) {
    const symbol = data.split(":")[1];
    const session = await getSession(env, chatId);
    
    if (session?.flow === "create_alert") {
      await setSession(env, chatId, { ...session, step: "select_operator", symbol });
      await editMessageText(env, chatId, messageId, "شرط رو انتخاب کن:", { reply_markup: OPERATOR_KEYBOARD });
    }
    return;
  }
  
  if (data.startsWith("op:")) {
    const operator = data.split(":")[1];
    const session = await getSession(env, chatId);
    
    if (session?.flow === "create_alert") {
      await setSession(env, chatId, { ...session, step: "awaiting_target", operator });
      await editMessageText(env, chatId, messageId, `قیمت هدف رو وارد کن:\n\nمثال: 70000`);
    }
    return;
  }
  
  if (data.startsWith("confirm:")) {
    const alertId = data.split(":")[1];
    const session = await getSession(env, chatId);
    
    if (session?.pending_alert) {
      await createAlert(env, chatId, session.pending_alert);
      await clearSession(env, chatId);
      await editMessageText(env, chatId, messageId, "✅ هشدار ذخیره شد!\n\nهر ۱۰ دقیقه بررسی می‌شه و در صورت رسیدن به شرط، بهت پیام می‌دم.");
    }
    return;
  }
  
  if (data.startsWith("cancel:")) {
    await clearSession(env, chatId);
    await editMessageText(env, chatId, messageId, "❌ لغو شد.");
    return;
  }
  
  if (data.startsWith("delete:")) {
    const alertId = data.split(":")[1];
    const deleted = await deleteAlert(env, chatId, alertId);
    
    if (deleted) {
      await editMessageText(env, chatId, messageId, "🗑 هشدار حذف شد.");
    } else {
      await editMessageText(env, chatId, messageId, "❌ هشدار پیدا نشد.");
    }
    return;
  }
  
  if (data === "menu:alerts") {
    await handleMyAlerts(env, chatId);
    return;
  }
  
  if (data.startsWith("back:")) {
    const target = data.split(":")[1];
    
    if (target === "market") {
      await handleCreateAlertStart(env, chatId);
    }
    return;
  }
}

export async function handleTextInSession(env, chatId, text) {
  const session = await getSession(env, chatId);
  
  if (!session) {
    return false;
  }
  
  // اگر در مراحل قبل از awaiting_target هستیم، راهنمایی کن
  if (session.step === "select_market") {
    await sendMessage(env, chatId, "لطفاً از دکمه‌های زیر یک بازار انتخاب کن:");
    await handleCreateAlertStart(env, chatId);
    return true;
  }
  
  if (session.step === "select_asset") {
    await sendMessage(env, chatId, "لطفاً از دکمه‌های زیر یک دارایی انتخاب کن.");
    return true;
  }
  
  if (session.step === "select_operator") {
    await sendMessage(env, chatId, "لطفاً از دکمه‌های زیر یک شرط انتخاب کن.");
    return true;
  }
  
  if (session.step !== "awaiting_target") {
    return false;
  }
  
  const target = parseFloat(text.replace(/[,\s]/g, ""));
  
  if (!target || target <= 0) {
    await sendMessage(env, chatId, "❌ قیمت نامعتبره. یک عدد معتبر وارد کن:");
    return true;
  }
  
  const alertData = {
    market: session.market,
    symbol: session.symbol,
    operator: session.operator,
    target,
  };
  
  let currentPrice = null;
  
  if (session.market === "crypto") {
    const prices = await getCryptoPrices();
    currentPrice = prices?.[session.symbol];
  } else {
    const prices = await getIranMarketPrices();
    currentPrice = prices?.[session.symbol];
  }
  
  const alertId = crypto.randomUUID().split("-")[0];
  await setSession(env, chatId, { ...session, step: "confirm", pending_alert: alertData });
  
  const confirmText = formatAlertConfirmation({ ...alertData, id: alertId }, currentPrice ? formatPrice(currentPrice) : null);
  await sendMessage(env, chatId, confirmText, { reply_markup: confirmAlertKeyboard(alertId) });
  
  return true;
}
