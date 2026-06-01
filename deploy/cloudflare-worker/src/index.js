import { handleStart, handleHelp, handlePricesMenu, handleMyAlerts, handleCreateAlertStart, handleUnknownMessage } from "./commands.js";
import { handleCallback, handleTextInSession } from "./callbacks.js";
import { isUpdateProcessed, markUpdateProcessed, setSession, clearSession } from "./sessions.js";
import { runCronJob } from "./cron.js";
import { sendMessage } from "./telegram.js";

function requireSecret(request, env) {
  const secret = env.TELEGRAM_SECRET_TOKEN;
  if (!secret) return null;
  
  const received = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (received !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "telegram-bot" });
    }
    
    if (url.pathname === "/setup-webhook" && request.method === "GET") {
      const botToken = env.TELEGRAM_BOT_TOKEN;
      const webhookUrl = "https://novax-telegram-relay.asdevelooper.workers.dev/webhook";
      const secretToken = env.TELEGRAM_SECRET_TOKEN;
      
      try {
        const setResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: webhookUrl, 
            secret_token: secretToken,
            allowed_updates: ["message", "edited_message", "callback_query"]
          })
        });
        const setResult = await setResponse.json();
        
        const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const infoResult = await infoResponse.json();
        
        return Response.json({ setWebhook: setResult, webhookInfo: infoResult });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
    
    if (url.pathname === "/webhook" && request.method === "POST") {
      const unauthorized = requireSecret(request, env);
      if (unauthorized) return unauthorized;
      
      const update = await request.json();
      
      if (update.update_id) {
        const processed = await isUpdateProcessed(env, update.update_id);
        if (processed) {
          return Response.json({ ok: true, duplicate: true });
        }
        await markUpdateProcessed(env, update.update_id);
      }
      
      if (update.callback_query) {
        try {
          await handleCallback(env, update.callback_query);
        } catch (error) {
          console.error("Callback error:", error.message, error.stack);
          await sendMessage(env, update.callback_query.message.chat.id, 
            "خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        }
        return Response.json({ ok: true });
      }
      
      const message = update.message || update.edited_message;
      if (!message) {
        return Response.json({ ok: true, ignored: true });
      }
      
      const chatId = message.chat.id;
      const text = message.text?.trim() || "";
      
      if (text.startsWith("/start")) {
        await handleStart(env, chatId, message.from);
        return Response.json({ ok: true });
      }
      
      if (text.startsWith("/help")) {
        await handleHelp(env, chatId);
        return Response.json({ ok: true });
      }
      
      if (text === "💰 قیمت‌ها") {
        await clearSession(env, chatId);
        await handlePricesMenu(env, chatId);
        return Response.json({ ok: true });
      }
      
      if (text === "🔔 تنظیم هشدار") {
        await setSession(env, chatId, { flow: "create_alert", step: "select_market" });
        await handleCreateAlertStart(env, chatId);
        return Response.json({ ok: true });
      }
      
      if (text === "📋 هشدارهای من") {
        await handleMyAlerts(env, chatId);
        return Response.json({ ok: true });
      }
      
      if (text === "❓ راهنما") {
        await handleHelp(env, chatId);
        return Response.json({ ok: true });
      }
      
      const handledInSession = await handleTextInSession(env, chatId, text);
      if (handledInSession) {
        return Response.json({ ok: true });
      }
      
      if (text) {
        await handleUnknownMessage(env, chatId);
      }
      
      return Response.json({ ok: true });
    }
    
    return new Response("Not Found", { status: 404 });
  },
  
  async scheduled(event, env, ctx) {
    const result = await runCronJob(env);
    console.log(`Cron completed: checked=${result.checked}, triggered=${result.triggered}`);
  }
};
