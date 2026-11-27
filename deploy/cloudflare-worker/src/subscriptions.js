import {
  auditAdminAction,
  getEntitlement,
  hasProductDb,
  listPendingPayments,
  PRO_PRICE_TOMAN,
  reviewPayment,
} from "./product-db.js";
import { clearSession } from "./sessions.js";
import { sendMessage } from "./telegram.js";
import { MAIN_KEYBOARD } from "./keyboards.js";
import { recordMetric } from "./metrics.js";
import { logEvent } from "./log.js";

function adminIds(env) {
  return new Set(
    String(env.ADMIN_TELEGRAM_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isAdmin(env, telegramUserId) {
  return adminIds(env).has(String(telegramUserId));
}

export function isPrivateChat(chatId) {
  return String(chatId).startsWith("-") === false;
}

export async function showSubscription(env, chatId, chatType) {
  logEvent("upgrade_clicked", { user_id: String(chatId), chat_type: chatType || "unknown" });
  recordMetric(env, "upgrade_clicked", {});
  if (!hasProductDb(env)) {
    await sendMessage(env, chatId, "سامانه اشتراک موقتاً در دسترس نیست.");
    return;
  }
  const entitlement = await getEntitlement(env, chatId);
  if (entitlement.plan === "pro") {
    const expiry = new Date(entitlement.subscription_expires_at).toLocaleDateString("fa-IR");
    await sendMessage(
      env,
      chatId,
      `💎 پلن شما: Pro\nتا تاریخ ${expiry} فعال است.\nسقف هشدار: ۳۰\nبررسی دوره‌ای طبق زمان‌بندی فعلی سرویس`,
      { reply_markup: MAIN_KEYBOARD },
    );
    return;
  }
  await sendMessage(env, chatId, "فروش اشتراک جدید Pro فعلاً تا پایان بازبینی سرویس متوقف است. لطفاً وجهی واریز نکنید. اگر قبلاً پرداخت کرده‌اید، از مسیر پشتیبانی رسمی پیگیری کنید.", { reply_markup: MAIN_KEYBOARD });
}

// Legacy payment sessions must not create new manual payment requests.
export async function handlePaymentReference(env, chatId, text, chatType) {
  if (chatType && chatType !== "private") return true;
  await clearSession(env, chatId);
  await sendMessage(env, chatId, "ثبت پرداخت جدید متوقف است. اگر قبلاً پرداخت کرده‌اید، از مسیر پشتیبانی رسمی پیگیری کنید.", { reply_markup: MAIN_KEYBOARD });
  return true;
}

export async function handleReceiptMedia(env, chatId, message, ctx) {
  if (!message.photo?.length && !message.document) return false;
  if (message.chat?.type && message.chat.type !== "private") return true;
  await clearSession(env, chatId);
  await sendMessage(env, chatId, "ثبت رسید جدید متوقف است. لطفاً وجهی واریز نکنید. پرداخت قبلی را از مسیر پشتیبانی رسمی پیگیری کنید.", { reply_markup: MAIN_KEYBOARD });
  return true;
}

export async function handleAdminStats(env, chatId) {
  if (!hasProductDb(env)) {
    await sendMessage(env, chatId, "D1 در دسترس نیست.");
    return;
  }
  try {
    const totalUsers = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
    const totalAlerts = await env.DB.prepare("SELECT COUNT(*) AS count FROM alerts").first();
    const activeAlerts = await env.DB.prepare("SELECT COUNT(*) AS count FROM alerts WHERE lifecycle_state = 'active'").first();
    const triggeredAlerts = await env.DB.prepare("SELECT COUNT(*) AS count FROM alerts WHERE lifecycle_state IN ('delivered', 'delivery_in_progress')").first();
    const pendingPayments = await env.DB.prepare("SELECT COUNT(*) AS count FROM payment_requests WHERE status = 'pending'").first();
    const proUsers = await env.DB.prepare("SELECT COUNT(DISTINCT telegram_user_id) as count FROM subscriptions WHERE status = 'active'").first();
    const topAssets = await env.DB.prepare(`
      SELECT display_asset_name_at_creation, COUNT(*) as count
      FROM alerts GROUP BY display_asset_name_at_creation
      ORDER BY count DESC LIMIT 5
    `).all();
    const upgradeClicks = await env.DB.prepare("SELECT COUNT(*) as count FROM admin_audit_logs WHERE action = 'approve_payment' OR action = 'reject_payment'").first();
    const miniAppOpens = await env.DB.prepare("SELECT COUNT(*) as count FROM user_campaigns WHERE first_source LIKE '%mini%' OR latest_source LIKE '%mini%'").first();

    const topAssetsText = (topAssets.results || []).map((r) => `  • ${r.display_asset_name_at_creation}: ${r.count}`).join("\n");
    await sendMessage(
      env,
      chatId,
      `📊 آمار سامانه\n\n👥 کل کاربران: ${Number(totalUsers?.count || 0)}\n🔔 کل هشدارها: ${Number(totalAlerts?.count || 0)}\n✅ هشدارهای فعال: ${Number(activeAlerts?.count || 0)}\n🔔 هشدارهای تحریک شده: ${Number(triggeredAlerts?.count || 0)}\n💎 کاربران Pro: ${Number(proUsers?.count || 0)}\n🧾 پرداخت‌های در انتظار: ${Number(pendingPayments?.count || 0)}\n💳 تراکنش‌های بررسی شده: ${Number(upgradeClicks?.count || 0)}\n\n📌 دارایی‌های پرطرفدار:\n${topAssetsText || "  — بدون داده"}`,
    );
  } catch (error) {
    await sendMessage(env, chatId, "خطا در دریافت آمار.");
  }
}

export async function handleAdminCommand(env, chatId, text) {
  if (String(text).startsWith("/admin_stats") || String(text).startsWith("/admin-stats")) {
    if (!isAdmin(env, chatId)) {
      await sendMessage(env, chatId, "دسترسی ادمین ندارید.");
      return true;
    }
    await handleAdminStats(env, chatId);
    return true;
  }
  if (!String(text).startsWith("/payments") &&
      !String(text).startsWith("/approve") &&
      !String(text).startsWith("/reject")) {
    return false;
  }
  if (!isAdmin(env, chatId)) {
    await sendMessage(env, chatId, "دسترسی ادمین ندارید.");
    return true;
  }
  if (!hasProductDb(env)) {
    await sendMessage(env, chatId, "D1 در دسترس نیست.");
    return true;
  }
  const [command, paymentId] = String(text).trim().split(/\s+/, 2);
  if (command.startsWith("/payments")) {
    const rows = await listPendingPayments(env);
    const body = rows.length
      ? rows.map((row) =>
          `${row.id} | ${row.telegram_user_id} | ${Number(row.amount_toman).toLocaleString("fa-IR")} تومان\n${row.reference}`,
        ).join("\n\n")
      : "درخواست پرداخت در انتظار بررسی وجود ندارد.";
    await sendMessage(env, chatId, `🧾 پرداخت‌های در انتظار\n\n${body}`);
    return true;
  }
  if (!paymentId) {
    await sendMessage(env, chatId, `فرمت صحیح: ${command} <payment_id>`);
    return true;
  }
  const approved = command.startsWith("/approve");
  const reviewed = await reviewPayment(env, paymentId, chatId, approved);
  if (!reviewed) {
    await sendMessage(env, chatId, "درخواست pending با این شناسه پیدا نشد.");
    return true;
  }
  await auditAdminAction(
    env,
    chatId,
    approved ? "approve_payment" : "reject_payment",
    "payment_request",
    paymentId,
    { telegram_user_id: reviewed.telegram_user_id },
  );
  await sendMessage(
    env,
    reviewed.telegram_user_id,
    approved
      ? `✅ پرداخت تأیید شد و پلن Pro تا ${new Date(reviewed.expires_at).toLocaleDateString("fa-IR")} فعال است.`
      : "❌ پرداخت تأیید نشد. لطفاً اطلاعات رسید را بررسی و دوباره ارسال کن.",
    { reply_markup: MAIN_KEYBOARD },
  );
  await sendMessage(env, chatId, approved ? "اشتراک فعال شد." : "درخواست رد شد.");
  return true;
}
