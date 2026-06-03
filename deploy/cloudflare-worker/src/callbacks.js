import { MARKET_KEYBOARD, CRYPTO_ASSETS, FIAT_ASSETS, GOLD_ASSETS, OPERATOR_KEYBOARD, confirmAlertKeyboard } from "./keyboards.js";
import { FLOW_STATES, buildAlertSummary, normalizeTargetPrice } from "./alert-flow.js";
import { getAssetByMarketSymbol } from "./asset-catalog.js";
import { editMessageText, answerCallbackQuery, sendMessage } from "./telegram.js";
import { getSession, setSession, clearSession } from "./sessions.js";
import { createAlert, deleteAlert } from "./alerts.js";
import { getCryptoPrices, getIranMarketPrices, formatPrice, formatCryptoPricesMessage, formatFiatPricesMessage, formatGoldPricesMessage, unitForMarket } from "./prices.js";
import { handleStart, handleMyAlerts, handleCreateAlertStart } from "./commands.js";

const ASSET_KEYBOARDS = {
  crypto: CRYPTO_ASSETS,
  fiat: FIAT_ASSETS,
  gold: GOLD_ASSETS,
};

const ASSET_PROMPTS = {
  crypto: "کدوم ارز دیجیتال رو می‌خوای؟",
  fiat: "کدوم ارز رو می‌خوای؟",
  gold: "کدوم دارایی رو می‌خوای؟",
};

export async function handleCallback(env, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data || callbackQuery.callback_data;

  if (!data) {
    console.error("No callback_data found:", JSON.stringify(callbackQuery));
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }

  await answerCallbackQuery(env, callbackQuery.id, "");

  if (data === "menu:main") {
    await handleStart(env, chatId, callbackQuery.from);
    return;
  }

  if (data.startsWith("market:")) {
    const market = data.split(":")[1];
    const session = await getSession(env, chatId);

    if (session?.flow === "create_alert") {
      await setSession(env, chatId, { flow: "create_alert", step: FLOW_STATES.CHOOSING_ASSET, market });

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
        await sendMessage(env, chatId, formatCryptoPricesMessage(prices));
      } else if (market === "fiat") {
        const prices = await getIranMarketPrices();
        await sendMessage(env, chatId, formatFiatPricesMessage(prices));
      } else if (market === "gold") {
        const prices = await getIranMarketPrices();
        await sendMessage(env, chatId, formatGoldPricesMessage(prices));
      }
    }
    return;
  }

  if (data.startsWith("asset:")) {
    const symbol = data.split(":")[1];
    const session = await getSession(env, chatId);

    if (session?.flow === "create_alert") {
      const asset = getAssetByMarketSymbol(session.market, symbol);
      if (!asset) {
        await editMessageText(env, chatId, messageId, "دارایی نامعتبر است. لطفاً دوباره انتخاب کن.");
        return;
      }
      await setSession(env, chatId, {
        ...session,
        step: FLOW_STATES.CHOOSING_CONDITION,
        symbol,
        canonical_asset_id: asset.canonical_asset_id,
        display_asset_name_at_creation: asset.display_name,
        target_price_display_unit: asset.unit,
      });
      await editMessageText(
        env,
        chatId,
        messageId,
        `دارایی انتخاب‌شده: ${asset.display_name}\nحالا شرط رو انتخاب کن:`,
        { reply_markup: OPERATOR_KEYBOARD },
      );
    }
    return;
  }

  if (data.startsWith("op:")) {
    const operator = data.split(":")[1];
    const session = await getSession(env, chatId);

    if (session?.flow === "create_alert") {
      await setSession(env, chatId, { ...session, step: FLOW_STATES.ENTERING_PRICE, operator });
      await editMessageText(env, chatId, messageId, `قیمت هدف را با واحد ${session.target_price_display_unit || unitForMarket(session.market)} وارد کن:\n\nمثال: 70000`);
    }
    return;
  }

  if (data.startsWith("confirm:")) {
    const alertId = data.split(":")[1];
    const session = await getSession(env, chatId);

    if (session?.pending_alert && session.step === FLOW_STATES.AWAITING_CONFIRMATION) {
      const alert = await createAlert(env, chatId, { ...session.pending_alert, id: alertId });
      await clearSession(env, chatId);
      const unit = alert.target_price_display_unit || unitForMarket(alert.market);
      await editMessageText(
        env,
        chatId,
        messageId,
        `✅ هشدار فعال شد.\n\n${alert.display_asset_name_at_creation} اگر ${alert.operator === "above" ? "بالاتر از" : "پایین‌تر از"} ${formatPrice(alert.target)} ${unit} برسد، بهت پیام می‌دم.`,
      );
    }
    return;
  }

  if (data === "edit:target") {
    const session = await getSession(env, chatId);
    if (session?.flow === "create_alert" && session.pending_alert) {
      await setSession(env, chatId, {
        ...session,
        step: FLOW_STATES.ENTERING_PRICE,
        pending_alert: null,
      });
      await editMessageText(
        env,
        chatId,
        messageId,
        `قیمت هدف جدید را با واحد ${session.target_price_display_unit || unitForMarket(session.market)} وارد کن:`,
      );
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
    const session = await getSession(env, chatId);

    if (target === "market") {
      await setSession(env, chatId, { flow: "create_alert", step: FLOW_STATES.CHOOSING_MARKET });
      await editMessageText(env, chatId, messageId, "کدوم بازار رو می‌خوای براش هشدار بسازی؟", { reply_markup: MARKET_KEYBOARD });
    } else if (target === "asset" && session?.flow === "create_alert" && session.market) {
      const keyboard = ASSET_KEYBOARDS[session.market];
      const prompt = ASSET_PROMPTS[session.market] || "دارایی رو انتخاب کن:";
      await setSession(env, chatId, { flow: "create_alert", step: FLOW_STATES.CHOOSING_ASSET, market: session.market });
      if (keyboard) {
        await editMessageText(env, chatId, messageId, prompt, { reply_markup: keyboard });
      }
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
  if (session.step === FLOW_STATES.CHOOSING_MARKET) {
    await sendMessage(env, chatId, "لطفاً از دکمه‌های زیر یک بازار انتخاب کن:");
    await handleCreateAlertStart(env, chatId);
    return true;
  }

  if (session.step === FLOW_STATES.CHOOSING_ASSET) {
    await sendMessage(env, chatId, "لطفاً از دکمه‌های زیر یک دارایی انتخاب کن.");
    return true;
  }

  if (session.step === FLOW_STATES.CHOOSING_CONDITION) {
    await sendMessage(env, chatId, "لطفاً از دکمه‌های زیر یک شرط انتخاب کن.");
    return true;
  }

  if (session.step !== FLOW_STATES.ENTERING_PRICE) {
    return false;
  }

  const target = normalizeTargetPrice(text);

  if (!target || target <= 0) {
    await sendMessage(env, chatId, `❌ قیمت نامعتبره. یک عدد مثبت با واحد ${session.target_price_display_unit || unitForMarket(session.market)} وارد کن:`);
    return true;
  }

  const alertData = {
    market: session.market,
    symbol: session.symbol,
    canonical_asset_id: session.canonical_asset_id,
    display_asset_name_at_creation: session.display_asset_name_at_creation || session.symbol,
    operator: session.operator,
    target,
    target_price_display_unit: session.target_price_display_unit || unitForMarket(session.market),
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
  await setSession(env, chatId, { ...session, step: FLOW_STATES.AWAITING_CONFIRMATION, pending_alert: alertData });

  const unit = alertData.target_price_display_unit;
  const currentPriceText = currentPrice
    ? `${formatPrice(currentPrice, session.market === "crypto" && currentPrice < 100 ? 2 : 0)} ${unit}`
    : "نامشخص";
  const confirmText = buildAlertSummary({ ...alertData, id: alertId }, currentPriceText);
  await sendMessage(env, chatId, confirmText, { reply_markup: confirmAlertKeyboard(alertId) });

  return true;
}
