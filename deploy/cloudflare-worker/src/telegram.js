function telegramApiUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

function retryAfterMs(result) {
  const seconds = Number(result?.parameters?.retry_after || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(response, result) {
  return response?.status === 429 || response?.status >= 500 || result?.error_code === 429 || result?.error_code >= 500;
}

export async function telegramApi(env, method, payload) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const timeoutMs = Number(env.TELEGRAM_API_TIMEOUT_MS || 8000);
  const maxAttempts = Math.max(1, Math.min(Number(env.TELEGRAM_API_MAX_ATTEMPTS || 3), 5));
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(telegramApiUrl(token, method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      let result;
      try {
        result = await response.json();
      } catch {
        result = { ok: false, description: "Telegram returned non-JSON response" };
      }
      if (attempt < maxAttempts && isRetryable(response, result)) {
        await sleep(Math.min(retryAfterMs(result) ?? 250 * attempt, 3000));
        continue;
      }
      return { response, result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(Math.min(250 * attempt, 3000));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`telegram_api_failed:${lastError?.name === "AbortError" ? "timeout" : (lastError?.message || "network_error")}`);
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
