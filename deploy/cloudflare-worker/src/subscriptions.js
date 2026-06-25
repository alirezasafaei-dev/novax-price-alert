import {
  auditAdminAction,
  createPaymentRequest,
  getEntitlement,
  hasProductDb,
  listPendingPayments,
  PRO_PRICE_TOMAN,
  reviewPayment,
} from "./product-db.js";
import { clearSession, setSession } from "./sessions.js";
import { sendMessage } from "./telegram.js";
import { MAIN_KEYBOARD } from "./keyboards.js";

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

export async function showSubscription(env, chatId) {
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
      `💎 پلن شما: Pro\nتا تاریخ ${expiry} فعال است.\nسقف هشدار: ۳۰\nفاصله بررسی: ۱ دقیقه`,
      { reply_markup: MAIN_KEYBOARD },
    );
    return;
  }
  const instructions =
    env.PAYMENT_INSTRUCTIONS ||
    "برای دریافت اطلاعات پرداخت، با پشتیبانی رسمی نواکس تماس بگیر.";
  await setSession(env, chatId, { flow: "manual_payment", step: "awaiting_reference" });
  await sendMessage(
    env,
    chatId,
    `💎 پلن Pro نواکس — ماهانه ${PRO_PRICE_TOMAN.toLocaleString("fa-IR")} تومان

مزایا:
• تا ۳۰ هشدار
• بررسی هر ۱ دقیقه
• هشدار تکرارشونده
• تاریخچه رخدادها

${instructions}

بعد از پرداخت، کد پیگیری یا توضیح رسید را همین‌جا ارسال کن.
برای لغو بنویس: لغو`,
  );
}

export async function handlePaymentReference(env, chatId, text) {
  if (!hasProductDb(env)) return false;
  if (String(text).trim() === "لغو") {
    await clearSession(env, chatId);
    await sendMessage(env, chatId, "درخواست خرید لغو شد.", { reply_markup: MAIN_KEYBOARD });
    return true;
  }
  try {
    const request = await createPaymentRequest(env, chatId, text);
    await clearSession(env, chatId);
    await sendMessage(
      env,
      chatId,
      request.already_pending
        ? `درخواست قبلی شما با شناسه ${request.id} هنوز در انتظار بررسی است.`
        : `✅ درخواست پرداخت ثبت شد.\nشناسه: ${request.id}\nپس از بررسی، نتیجه در همین بات اعلام می‌شود.`,
      { reply_markup: MAIN_KEYBOARD },
    );
  } catch (error) {
    await sendMessage(env, chatId, `❌ ${String(error?.message || error)}`);
  }
  return true;
}

export async function handleAdminCommand(env, chatId, text) {
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
