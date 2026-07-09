import { FLOW_STATES } from "./alert-flow.js";
import { handleStart, handleHelp, handlePricesMenu, handleMyAlerts, handleCreateAlertStart, handleUnknownMessage, handleFaq, handleMiniAppMenu, handleInlineQuery } from "./commands.js";
import { handleCallback, handleTextInSession } from "./callbacks.js";
import { isUpdateProcessed, markUpdateProcessed, setSession, clearSession, getSession } from "./sessions.js";
import { runCronJob } from "./cron.js";
import { recordCronHeartbeat, getCronStatus } from "./heartbeat.js";
import { sendMessage, telegramApi } from "./telegram.js";
import { logEvent, logWarn, logError } from "./log.js";
import { handleMiniAppApi } from "./miniapp-api.js";
import { handleMiniAppStatic } from "./miniapp-static.js";
import { getCryptoPrices, getIranMarketPrices, formatPrice } from "./prices.js";
import { hasProductDb } from "./product-db.js";
import {
  handleAdminCommand,
  handlePaymentReference,
  showSubscription,
  handleReceiptMedia,
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

/** Only respond in groups if message is relevant to the bot. */
function isRelevantGroupMessage(message, env) {
  if (!message) return false;
  const chatType = message.chat?.type;
  if (chatType === 'private') return true;

  const text = (message.text || '').trim();
  if (!text || text.startsWith('/')) return true;

  // Check if bot is mentioned (@novax_price_bot)
  const entities = message.entities || [];
  const botUsername = (env.BOT_USERNAME || '').toLowerCase();
  if (botUsername) {
    const hasMention = entities.some(e =>
      e.type === 'mention' &&
      text.substring(e.offset, e.offset + e.length).toLowerCase() === `@${botUsername}`
    );
    if (hasMention) return true;
  }

  // Reply to a bot message (user tapped reply on bot's post)
  if (message.reply_to_message?.from?.is_bot) return true;

  // Price/domain keywords (no greetings — avoid replying to random social chatter)
  const keywords = [
    'قیمت', 'چنده', 'چند', 'طلا', 'بیت', 'دلار', 'تتر', 'سکه',
    'اتریوم', 'بایننس', 'سولانا', 'ارز', 'رمزارز', 'نواکس', 'novax',
    'bnb', 'btc', 'eth', 'sol', 'usdt', 'گزارش', 'قیمتش',
    'نرخ', 'gold', 'dollar', 'tether', 'sats',
  ];
  const lower = text.toLowerCase();
  if (keywords.some(k => lower.includes(k))) return true;

  return false;
}

/** After 3rd relevant NLP interaction in a group, promote the mini-app once per user. */
async function maybePromoteUser(env, chatId, userId, username) {
  if (!userId || !chatId) return;
  const key = `promo:${userId}`;
  const val = await env.USERS_KV.get(key);
  if (val === 'd') return;

  const count = val ? parseInt(val, 10) + 1 : 1;
  if (count < 3) {
    await env.USERS_KV.put(key, String(count), { expirationTtl: 86400 * 7 });
    return;
  }

  const miniAppUrl = env.NOVAX_MINI_APP_URL || env.MINI_APP_URL
    || (env.BOT_USERNAME ? `https://t.me/${env.BOT_USERNAME}/miniapp` : null);
  const mention = username ? `@${username}` : null;
  const text = [
    mention ? `👋 ${mention}!` : '👋 سلام!',
    '',
    'می‌دونستی نواکس یه داشبورد هوشمند هم داره؟ 🌐',
    'مینی‌اپ اختصاصی با نمودار قیمت لحظه‌ای، تحلیل هوش مصنوعی Gemini و مدیریت هشدار هوشمند!',
    miniAppUrl ? `\n🚀 ${miniAppUrl}` : '',
    '\nراستی دوستاتم دعوت کن، هر ۳ نفر = ۷ روز Pro رایگان 🎁',
  ].filter(Boolean).join('\n');
  await sendMessage(env, chatId, text);
  await env.USERS_KV.put(key, 'd', { expirationTtl: 86400 * 60 });
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

const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>سیاست حفظ حریم خصوصی - نواکس</title>
<style>
  body{font-family:system-ui,sans-serif;line-height:1.8;max-width:720px;margin:0 auto;padding:24px;color:#e2e8f0;background:#0f172a}
  h1{color:#2dd4bf;border-bottom:2px solid #334155;padding-bottom:8px}
  h2{color:#67e8f9;margin-top:32px;font-size:1.1em}
  p,li{color:#cbd5e1}
  ul{padding-right:20px}
  a{color:#2dd4bf}
  footer{margin-top:48px;padding-top:16px;border-top:1px solid #334155;font-size:.85em;color:#64748b}
</style>
</head>
<body>
<h1>🔒 سیاست حفظ حریم خصوصی</h1>
<p><strong>آخرین به‌روزرسانی:</strong> جولای ۲۰۲۶</p>

<p>نواکس یک ربات تلگرام و مینی‌اپ برای مدیریت هشدارهای قیمت رمزارز، ارز، تتر و طلا است. این سیاست توضیح می‌دهد چه داده‌هایی جمع‌آوری می‌شود و چگونه استفاده می‌شود.</p>

<h2>۱. داده‌هایی که جمع‌آوری می‌کنیم</h2>
<p>فقط حداقل داده لازم برای عملکرد بات و مینی‌اپ جمع‌آوری می‌شود:</p>
<ul>
  <li>اطلاعات کاربر تلگرام: آیدی، یوزرنیم، نام، نام خانوادگی، زبان</li>
  <li>تنظیمات هشدار: دارایی، قیمت هدف، شرط، وضعیت، زمان‌بندی</li>
  <li>سوابق اشتراک و درخواست پرداخت (ارجاعات پرداختی که کاربر ارسال می‌کند)</li>
  <li>اطلاعات دعوت و کمپین (در صورت استفاده از لینک دعوت)</li>
  <li>نمونه‌های قیمت و فراداده تأمین‌کننده برای بررسی هشدارها</li>
  <li>لاگ‌های عملیاتی برای امنیت، رفع اشکال و جلوگیری از سوءاستفاده</li>
</ul>
<p>ما شماره کارت، رمز بانکی، کلید خصوصی کیف پول یا اطلاعات حساب صرافی درخواست نمی‌کنیم.</p>

<h2>۲. چگونه از داده‌ها استفاده می‌کنیم</h2>
<ul>
  <li>ایجاد، تأیید، مدیریت و ارسال هشدارهای قیمت</li>
  <li>نمایش هشدارهای فعال و تاریخچه به کاربر</li>
  <li>مدیریت محدودیت‌های پلن رایگان و حرفه‌ای</li>
  <li>بررسی دستی درخواست اشتراک/پرداخت</li>
  <li>پاداش دعوت و انتساب کمپین</li>
  <li>بهبود قابلیت اطمینان، امنیت و جلوگیری از سوءاستفاده</li>
  <li>ارسال پیام‌های تلگرام لازم برای عملکرد بات</li>
</ul>

<h2>۳. ذخیره‌سازی و زیرساخت</h2>
<p>سرویس اصلی از Cloudflare Worker، Cloudflare D1 و Cloudflare KV استفاده می‌کند. داده‌های محصول (کاربران، هشدارها، رویدادها، اشتراک‌ها، درخواست‌های پرداخت، دعوت‌ها) در D1 ذخیره می‌شوند. KV برای دارایی‌های مینی‌اپ، نشست‌های کوتاه‌مدت و کش استفاده می‌شود.</p>

<h2>۴. سرویس‌های شخص ثالث</h2>
<ul>
  <li>Telegram Bot API و پلتفرم Mini App</li>
  <li>Cloudflare برای میزبانی، دیتابیس، کش و امنیت</li>
  <li>بین‌نس و TGJU برای داده‌های قیمت</li>
  <li>Groq برای پاسخ‌های هوشمند (اختیاری)</li>
</ul>
<p>ما داده‌های شخصی کاربران را نمی‌فروشیم.</p>

<h2>۵. پرداخت‌ها</h2>
<p>در زمان تأیید دستی اشتراک، کاربر ممکن است یک مرجع پرداخت ارسال کند. ما شماره کارت یا اطلاعات بانکی کامل را از طریق بات جمع‌آوری نمی‌کنیم.</p>

<h2>۶. امنیت</h2>
<p>لاگ‌های عملیاتی برای مانیتورینگ خطا، جلوگیری از سوءاستفاده و بهبود سرویس استفاده می‌شوند. توکن‌های بات، رمز عبور و کلیدهای API هرگز لاگ نمی‌شوند.</p>

<h2>۷. حذف داده‌ها</h2>
<p>کاربران می‌توانند هشدارهای خود را از بات یا مینی‌اپ حذف کنند. برای درخواست حذف کامل حساب یا داده‌ها، با اپراتور بات از طریق کانال پشتیبانی تماس بگیرید.</p>

<h2>۸. تغییرات در این سیاست</h2>
<p>ممکن است این سیاست را به‌روزرسانی کنیم. آخرین نسخه همیشه در این آدرس در دسترس است.</p>

<h2>۹. تماس</h2>
<p>برای سوالات حریم خصوصی یا درخواست حذف داده، با اپراتور بات از طریق کانال پشتیبانی داخل بات تماس بگیرید.</p>

<footer>
  <p>نواکس | @novax_price_bot</p>
</footer>
</body>
</html>`;

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
    
    if (url.pathname === "/privacy") {
      return new Response(PRIVACY_POLICY_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const { message, chatHistory } = await request.json();
        if (!message || typeof message !== 'string') {
          return Response.json({ error: "message is required" }, { status: 400 });
        }

        let cryptoPrices, iranPrices;
        try {
          [cryptoPrices, iranPrices] = await Promise.all([
            getCryptoPrices().catch(() => ({})),
            getIranMarketPrices().catch(() => ({})),
          ]);
        } catch {
          cryptoPrices = {}; iranPrices = {};
        }

        const snapshot = [
          cryptoPrices?.BTC ? `BTC: $${formatPrice(cryptoPrices.BTC)}` : null,
          cryptoPrices?.ETH ? `ETH: $${formatPrice(cryptoPrices.ETH)}` : null,
          cryptoPrices?.SOL ? `SOL: $${formatPrice(cryptoPrices.SOL)}` : null,
          cryptoPrices?.BNB ? `BNB: $${formatPrice(cryptoPrices.BNB)}` : null,
          iranPrices?.USD ? `USD: ${formatPrice(iranPrices.USD)} تومان` : null,
          iranPrices?.USDT ? `USDT: ${formatPrice(iranPrices.USDT)} تومان` : null,
          iranPrices?.GOLD_18K ? `GOLD: ${formatPrice(iranPrices.GOLD_18K)} تومان` : null,
          iranPrices?.SEKKEH_EMAMI ? `SEKKEH_EMAMI: ${formatPrice(iranPrices.SEKKEH_EMAMI)} تومان` : null,
        ].filter(Boolean).join(", ");

        const isFa = /[آ-ی]/.test(message);
        const langInstruction = isFa
          ? 'تو یک تحلیلگر مالی حرفه‌ای هستی. فارسی پاسخ بده، حداکثر ۳-۴ خط، دوستانه و حرفه‌ای.'
          : 'You are a professional financial analyst. Answer in English, max 3-4 lines, friendly and professional.';

        const groqKey = env.GROQ_API_KEY;
        let groqResponse = null;
        if (groqKey) {
          const systemPrompt = `${langInstruction}\n\nقیمت‌های فعلی بازار:\n${snapshot || "نامشخص"}`;
          groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "mixtral-8x7b-32768",
            messages: [
              { role: "system", content: systemPrompt },
              ...(chatHistory || []).slice(-10).map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.text,
              })),
              { role: "user", content: message },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(12000),
        });

          if (!groqResponse.ok) {
            logError("chat_api_groq_error", { status: groqResponse.status });
          } else {
            const data = await groqResponse.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            if (text) return Response.json({ text });
          }
        }

        // Local fallback when Groq is unavailable
        const lowerMsg = message.toLowerCase();
        const btcPrice = cryptoPrices?.BTC ? `$${formatPrice(cryptoPrices.BTC)}` : '—';
        const ethPrice = cryptoPrices?.ETH ? `$${formatPrice(cryptoPrices.ETH)}` : '—';
        const goldPrice = iranPrices?.GOLD_18K ? `${formatPrice(iranPrices.GOLD_18K)} تومان` : '—';
        const usdPrice = iranPrices?.USD ? `${formatPrice(iranPrices.USD)} تومان` : '—';

        if (lowerMsg.includes('بیت') || lowerMsg.includes('btc') || lowerMsg.includes('bitcoin')) {
          return Response.json({
            text: isFa
              ? `📊 تحلیل بیت‌کوین (BTC)\n\nقیمت فعلی: ${btcPrice}\n\nبیت‌کوین به عنوان بزرگترین رمزارز جهان، نقش بازار را تعیین می‌کند. برای تحلیل دقیق‌تر، اندیکاتورهای تکنیکال و اخبار بنیادی را بررسی کنید.\n\n📌 پیشنهاد: از بخش چارت برای مشاهده روند قیمت استفاده کنید.`
              : `📊 Bitcoin (BTC) Analysis\n\nCurrent Price: ${btcPrice}\n\nBitcoin, as the largest cryptocurrency, sets the market direction. For detailed analysis, check technical indicators and fundamental news.\n\n📌 Tip: Use the Chart section to view the price trend.`
          });
        }
        if (lowerMsg.includes('اتریوم') || lowerMsg.includes('eth') || lowerMsg.includes('ethereum')) {
          return Response.json({
            text: isFa
              ? `📊 تحلیل اتریوم (ETH)\n\nقیمت فعلی: ${ethPrice}\n\nاتریوم با اکوسیستم گسترده دیفای و قراردادهای هوشمند، جایگاه دوم بازار را دارد. اتریوم معمولاً هم‌راستا با بیت‌کوین حرکت می‌کند اما نوسانات کمتری دارد.\n\n📌 پیشنهاد: حتماً اخبار آپدیت‌های شبکه را دنبال کنید.`
              : `📊 Ethereum (ETH) Analysis\n\nCurrent Price: ${ethPrice}\n\nEthereum, with its vast DeFi ecosystem and smart contracts, holds the second market position. ETH typically moves in line with BTC but with lower volatility.\n\n📌 Tip: Follow network upgrade news closely.`
          });
        }
        if (lowerMsg.includes('طلا') || lowerMsg.includes('gold') || lowerMsg.includes('سکه')) {
          return Response.json({
            text: isFa
              ? `🥇 تحلیل طلا و سکه\n\nقیمت طلا (۱۸ عیار): ${goldPrice}\nدلار آزاد: ${usdPrice}\n\nقیمت طلا و سکه در ایران عمدتاً تابع قیمت دلار و انس جهانی است. طلا به عنوان پناهگاه امن سرمایه در شرایط تورمی شناخته می‌شود.\n\n📌 پیشنهاد: می‌توانید با تنظیم هشدار قیمت در بات، از تغییرات مطلع شوید.`
              : `🥇 Gold & Coin Analysis\n\nGold (18K): ${goldPrice}\nUSD Free: ${usdPrice}\n\nGold prices in Iran mainly follow USD rates and global spot. Gold is considered a safe haven in inflationary conditions.`
          });
        }
        return Response.json({
          text: isFa
            ? `📈 بازار لحظه‌ای:\n• بیت‌کوین: ${btcPrice}\n• اتریوم: ${ethPrice}\n• طلا: ${goldPrice}\n• دلار: ${usdPrice}\n\n💡 سوالات متداول:\n• "بیت‌کوین رو تحلیل کن"\n• "قیمت طلا"\n• "اتریوم چنده؟"\n\nاز منوی قیمت‌ها و چارت برای اطلاعات بیشتر استفاده کنید.`
            : `📈 Live Market:\n• Bitcoin: ${btcPrice}\n• Ethereum: ${ethPrice}\n• Gold: ${goldPrice}\n• USD: ${usdPrice}\n\n💡 Try asking:\n• "Analyze Bitcoin"\n• "Gold price"\n• "Ethereum analysis"\n\nUse the Prices menu and Chart for more details.`
        });
      } catch (error) {
        logError("chat_api_error", { error_message: error?.message || "chat failed" });
        return Response.json({
          text: /[آ-ی]/.test(String(error?.message || ''))
            ? '⚠️ خطا در ارتباط با سرور تحلیل. لطفاً دوباره تلاش کنید.'
            : '⚠️ AI server error. Please try again.'
        });
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
          allowed_updates: ["message", "edited_message", "callback_query", "inline_query"],
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
            allowed_updates: ["message", "edited_message", "callback_query", "inline_query"],
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

        if (update.inline_query) {
          await handleInlineQuery(env, update.inline_query);
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

        if (text.startsWith("/prices") || text.startsWith("/price")) {
          await clearSession(env, chatId);
          await handlePricesMenu(env, chatId);
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
          await showSubscription(env, chatId, message.chat?.type);
          return ok();
        }

        if (text === "❓ راهنما") {
          await handleHelp(env, chatId);
          return ok();
        }

        const session = await getSession(env, chatId);
        if (session?.flow === "manual_payment") {
          await handlePaymentReference(env, chatId, text, message.chat?.type);
          return ok();
        }

        const handledInSession = await handleTextInSession(env, chatId, text);
        if (handledInSession) {
          return ok();
        }

        if (text && isRelevantGroupMessage(message, env)) {
          const msgId = update?.message?.message_id;
          await handleUnknownMessage(env, chatId, text, msgId);
          // Track interactions & promote mini-app in groups (after 3rd NLP hit)
          if (message.chat?.type !== 'private') {
            ctx.waitUntil(maybePromoteUser(env, chatId, message.from?.id, message.from?.username));
          }
        }

        // Detect receipt-like media (photo/document) in private chat for payment review
        if (message.chat?.type === "private" && (message.photo || message.document)) {
          const mediaReceiptHandled = await handleReceiptMedia(env, chatId, message, ctx);
          if (mediaReceiptHandled) {
            return ok();
          }
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
