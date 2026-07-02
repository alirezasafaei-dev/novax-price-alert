import { FLOW_STATES } from "./alert-flow.js";
import { handleStart, handleHelp, handlePricesMenu, handleMyAlerts, handleCreateAlertStart, handleUnknownMessage, handleFaq, handleMiniAppMenu } from "./commands.js";
import { handleCallback, handleTextInSession } from "./callbacks.js";
import { isUpdateProcessed, markUpdateProcessed, setSession, clearSession, getSession } from "./sessions.js";
import { runCronJob } from "./cron.js";
import { recordCronHeartbeat, getCronStatus } from "./heartbeat.js";
import { sendMessage, telegramApi } from "./telegram.js";
import { logEvent, logWarn, logError } from "./log.js";
import { handleMiniAppApi } from "./miniapp-api.js";
import { handleMiniAppStatic } from "./miniapp-static.js";
import { hasProductDb } from "./product-db.js";
import {
  handleAdminCommand,
  handlePaymentReference,
  showSubscription,
} from "./subscriptions.js";
import {
  parseStartParam,
  recordCampaignVisit,
  isReferralSource,
  extractReferrerId,
  isUserNew,
  recordReferral,
  handleGrowthCommand,
} from "./growth.js";
import { isAdmin } from "./subscriptions.js";

function requireSecret(request, env) {
  const secret = env.TELEGRAM_SECRET_TOKEN;
  if (!secret) return new Response("Webhook secret is not configured", { status: 503 });
  
  const received = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (received !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

function getWebhookChatId(update) {
  return String(update?.message?.chat?.id || update?.edited_message?.chat?.id || update?.callback_query?.message?.chat?.id || "") || null;
}

function requireSetupSecret(request, env) {
  const expected = env.SETUP_SECRET || env.TELEGRAM_SECRET_TOKEN;
  const received = request.headers.get("X-Setup-Secret");
  if (!expected || !received || received !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    let miniAppResponse;
    try {
      miniAppResponse = await handleMiniAppStatic(request, env);
    } catch (error) {
      logError("miniapp_static_error", { error_message: error?.message || "static asset failed" });
      miniAppResponse = null;
    }
    if (miniAppResponse) return miniAppResponse;

    if (request.method === "OPTIONS" || url.pathname.startsWith("/api/v1/")) {
      try {
        const apiResponse = await handleMiniAppApi(request, env);
        if (apiResponse) return apiResponse;
      } catch (error) {
        logError("miniapp_api_error", {
          path: url.pathname,
          error_message: error?.message || "mini app api failed",
        });
        return Response.json(
          { detail: error?.message || "Mini App API unavailable", error: error?.message || "Mini App API unavailable" },
          { status: error?.status || 500 },
        );
      }
    }
    
    if (url.pathname === "/health") {
      const d1Configured = hasProductDb(env);
      const d1Required = String(env.REQUIRE_D1 || "false").toLowerCase() === "true";
      let d1Healthy = d1Configured;
      if (d1Configured) {
        try {
          await env.DB.prepare("SELECT 1 AS ok").first();
        } catch {
          d1Healthy = false;
        }
      }
      const degraded = d1Required && !d1Healthy;
      return Response.json(
        {
          status: degraded ? "degraded" : "ok",
          service: "telegram-bot",
          alert_storage: d1Healthy ? "d1" : "legacy_kv",
        },
        { status: degraded ? 503 : 200 },
      );
    }

    // وضعیت ضربان cron برای مانیتور بیرونی. وقتی ضربان کهنه باشد ۵۰۳ برمی‌گرداند
    // تا چک‌کننده‌های ساده فقط با کد وضعیت HTTP هم بتوانند هشدار بدهند.
    if (url.pathname === "/status") {
      const status = await getCronStatus(env);
      return Response.json(status, { status: status.stale ? 503 : 200 });
    }
    
    if (url.pathname === "/setup-webhook" && request.method === "POST") {
      const unauthorized = requireSetupSecret(request, env);
      if (unauthorized) return unauthorized;
      const webhookUrl = `${url.origin}/webhook`;
      const secretToken = env.TELEGRAM_SECRET_TOKEN;
      
      try {
        const { result: setResult } = await telegramApi(env, "setWebhook", {
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ["message", "edited_message", "callback_query"],
        });
        const { result: infoResult } = await telegramApi(env, "getWebhookInfo", {});
        
        return Response.json({ setWebhook: setResult, webhookInfo: infoResult });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    if (url.pathname === "/setup-bot" && request.method === "POST") {
      const unauthorized = requireSetupSecret(request, env);
      if (unauthorized) return unauthorized;
      const webhookUrl = `${url.origin}/webhook`;
      const secretToken = env.TELEGRAM_SECRET_TOKEN;

      try {
        const [webhookResult, commandsResult] = await Promise.all([
          telegramApi(env, "setWebhook", {
            url: webhookUrl,
            secret_token: secretToken,
            allowed_updates: ["message", "edited_message", "callback_query"],
          }),
          telegramApi(env, "setMyCommands", {
            commands: [
              { command: "start", description: "شروع ربات" },
              { command: "help", description: "راهنما" },
              { command: "prices", description: "قیمت‌های لحظه‌ای" },
              { command: "pro", description: "خرید یا مشاهده پلن Pro" },
              { command: "faq", description: "سوالات پرتکرار" },
            ],
          }),
        ]);

        return Response.json({
          webhook: webhookResult.result,
          commands: commandsResult.result,
          webhook_url: webhookUrl,
        }, { status: webhookResult.response.ok && commandsResult.response.ok ? 200 : 500 });
      } catch (error) {
        logError("setup_bot_error", { error_message: error?.message || "setup failed" });
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
    
    if (url.pathname === "/webhook" && request.method === "POST") {
      const unauthorized = requireSecret(request, env);
      if (unauthorized) return unauthorized;

      let update;
      try {
        update = await request.json();
      } catch (error) {
        logWarn("webhook_malformed_json", { error_message: error?.message || "invalid json" });
        return Response.json({ ok: false, error: "malformed_json" }, { status: 400 });
      }

      if (update.update_id) {
        const processed = await isUpdateProcessed(env, update.update_id);
        if (processed) {
          logEvent("webhook_duplicate_update", { update_id: String(update.update_id) });
          return Response.json({ ok: true, duplicate: true });
        }
      }

      const ok = async (body = { ok: true }) => {
        if (update.update_id) await markUpdateProcessed(env, update.update_id);
        return Response.json(body);
      };

      try {
        if (update.callback_query) {
          await handleCallback(env, update.callback_query);
          return ok();
        }

        const message = update.message || update.edited_message;
        if (!message) {
          return ok({ ok: true, ignored: true });
        }

        const chatId = message.chat.id;
        const text = message.text?.trim() || "";

        if (await handleAdminCommand(env, chatId, text)) {
          return ok();
        }

        if (text.startsWith("/growth")) {
          if (!isAdmin(env, chatId)) {
            await sendMessage(env, chatId, "دسترسی ادمین ندارید.");
          } else {
            await handleGrowthCommand(env, chatId);
          }
          return ok();
        }

        if (text.startsWith("/start")) {
          const startParam = parseStartParam(text);
          // Check referral eligibility before handleStart creates the user in D1
          let isReferralEligible = false;
          if (startParam && isReferralSource(startParam)) {
            const referrerId = extractReferrerId(startParam);
            if (referrerId && referrerId !== String(chatId)) {
              isReferralEligible = await isUserNew(env, chatId);
            }
          }
          await handleStart(env, chatId, message.from, startParam);
          if (startParam) {
            await recordCampaignVisit(env, chatId, startParam);
          }
          if (isReferralEligible) {
            const referrerId = extractReferrerId(startParam);
            await recordReferral(env, referrerId, chatId);
          }
          return ok();
        }

        if (text.startsWith("/help")) {
          await handleHelp(env, chatId);
          return ok();
        }

        if (text.startsWith("/faq")) {
          await handleFaq(env, chatId);
          return ok();
        }

        if (text === "💰 قیمت‌ها") {
          await clearSession(env, chatId);
          await handlePricesMenu(env, chatId);
          return ok();
        }

        if (text === "🔔 تنظیم هشدار") {
          await setSession(env, chatId, { flow: "create_alert", step: FLOW_STATES.CHOOSING_MARKET });
          await handleCreateAlertStart(env, chatId);
          return ok();
        }

        if (text === "📋 هشدارهای من") {
          await handleMyAlerts(env, chatId);
          return ok();
        }

        if (text === "🌐 داشبورد هوشمند") {
          await handleMiniAppMenu(env, chatId);
          return ok();
        }

        if (text === "💎 ارتقا به Pro" || text.startsWith("/pro")) {
          await showSubscription(env, chatId);
          return ok();
        }

        if (text === "❓ راهنما") {
          await handleHelp(env, chatId);
          return ok();
        }

        const session = await getSession(env, chatId);
        if (session?.flow === "manual_payment") {
          await handlePaymentReference(env, chatId, text);
          return ok();
        }

        const handledInSession = await handleTextInSession(env, chatId, text);
        if (handledInSession) {
          return ok();
        }

        if (text) {
          await handleUnknownMessage(env, chatId);
        }

        return ok();
      } catch (error) {
        logError("webhook_handler_error", {
          update_id: update?.update_id ? String(update.update_id) : null,
          chat_id: getWebhookChatId(update),
          error_message: error?.message || "webhook failed",
        });
        return Response.json({ ok: false, error: "handler_failed" }, { status: error?.status || 500 });
      }
    }
    
    return new Response("Not Found", { status: 404 });
  },
  
  async scheduled(event, env, ctx) {
    try {
      const result = await runCronJob(env);
      await recordCronHeartbeat(env, result);
      logEvent("cron_invocation_completed", { checked: result.checked, triggered: result.triggered });
    } catch (error) {
      logError("cron_handler_error", { error_message: error?.message || "cron failed" });
      await recordCronHeartbeat(env, { checked: 0, triggered: 0, error: error?.message }).catch(() => {});
    }
  }
};
