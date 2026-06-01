export async function telegramApi(env, method, payload) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  return { response, result };
}

export async function sendMessage(env, chatId, text, options = {}) {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode,
    reply_markup: options.reply_markup,
    disable_web_page_preview: true,
  });
}

export async function editMessageText(env, chatId, messageId, text, options = {}) {
  return telegramApi(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options.parse_mode,
    reply_markup: options.reply_markup,
    disable_web_page_preview: true,
  });
}

export async function answerCallbackQuery(env, callbackQueryId, text = null) {
  const params = {
    callback_query_id: callbackQueryId,
  };
  if (text) {
    params.text = text;
  }
  return telegramApi(env, "answerCallbackQuery", params);
}
