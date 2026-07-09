import { hasProductDb, getEntitlement, PRO_DURATION_DAYS } from "./product-db.js";
import { sendMessage, telegramApi } from "./telegram.js";
import { logEvent, logWarn, logError } from "./log.js";
import { getCryptoPrices, getIranMarketPrices, formatPrice } from "./prices.js";

const VALID_REFERRALS_FOR_REWARD = 3;
const REWARD_PRO_DAYS = 7;
const DEFAULT_MARKETING_HOUR_TEHRAN = 10;

function nowIso() {
  return new Date().toISOString();
}

// ── Tehran Time Helpers ───────────────────────────────────────────────

export function getTehranDateHour(now) {
  const d = now || new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return {
    date: `${get("year")}${get("month")}${get("day")}`,
    hour: Number(get("hour")),
  };
}

export function getMarketingPostHour(env) {
  const raw = String(env.MARKETING_POST_HOUR_TEHRAN ?? "").trim();
  if (raw === "") return DEFAULT_MARKETING_HOUR_TEHRAN;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23 || Math.floor(parsed) !== parsed) {
    logWarn("marketing_invalid_hour", { raw, fallback: DEFAULT_MARKETING_HOUR_TEHRAN });
    return DEFAULT_MARKETING_HOUR_TEHRAN;
  }
  return parsed;
}

export function getDailyMarketingCampaignId(now) {
  const { date } = getTehranDateHour(now);
  return `post_daily_${date}`;
}

// ── Campaign Attribution ──────────────────────────────────────────────

export async function recordCampaignVisit(env, telegramUserId, source) {
  if (!hasProductDb(env) || !source) return;
  const now = nowIso();
  const userId = String(telegramUserId);

  const existing = await env.DB.prepare(`
    SELECT first_source, first_seen_at FROM user_campaigns WHERE telegram_user_id = ?
  `).bind(userId).first();

  if (existing) {
    await env.DB.prepare(`
      UPDATE user_campaigns SET latest_source = ?, latest_seen_at = ?
      WHERE telegram_user_id = ?
    `).bind(source, now, userId).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO user_campaigns (telegram_user_id, first_source, first_seen_at, latest_source, latest_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, source, now, source, now).run();
  }
}

export function parseStartParam(startText) {
  const match = String(startText || "").match(/^\/start\s+(\S+)/);
  return match ? match[1] : null;
}

export function isReferralSource(source) {
  return /^ref_\d+$/.test(source || "");
}

export function isMarketingSource(source) {
  return /^post_daily_/.test(source || "");
}

export function extractReferrerId(source) {
  if (!isReferralSource(source)) return null;
  return source.replace("ref_", "");
}

// ── Referral System ───────────────────────────────────────────────────

export async function isUserNew(env, telegramUserId) {
  if (!hasProductDb(env)) return false;
  const row = await env.DB.prepare(`
    SELECT 1 FROM users WHERE telegram_user_id = ?
  `).bind(String(telegramUserId)).first();
  return !row;
}

export async function recordReferral(env, referrerId, invitedId) {
  if (!hasProductDb(env)) return null;
  const now = nowIso();
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`
      INSERT INTO referrals (id, referrer_telegram_user_id, invited_telegram_user_id, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).bind(id, String(referrerId), String(invitedId), now).run();
    return id;
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE")) return null;
    throw error;
  }
}

export async function validateReferralOnAlert(env, invitedId) {
  if (!hasProductDb(env)) return null;
  const userId = String(invitedId);

  const referral = await env.DB.prepare(`
    SELECT id, referrer_telegram_user_id FROM referrals
    WHERE invited_telegram_user_id = ? AND status = 'pending'
  `).bind(userId).first();

  if (!referral) return null;
  if (String(referral.referrer_telegram_user_id) === userId) {
    await env.DB.prepare(`
      UPDATE referrals SET status = 'rejected' WHERE id = ?
    `).bind(referral.id).run();
    return null;
  }

  const now = nowIso();
  await env.DB.prepare(`
    UPDATE referrals SET status = 'valid', validated_at = ? WHERE id = ?
  `).bind(now, referral.id).run();

  logEvent("referral_validated", {
    referrer_id: referral.referrer_telegram_user_id,
    invited_id: userId,
  });

  await maybeGrantReferralReward(env, referral.referrer_telegram_user_id);
  return referral.referrer_telegram_user_id;
}

async function maybeGrantReferralReward(env, referrerId) {
  if (!hasProductDb(env)) return;
  const userId = String(referrerId);

  const validCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM referrals
    WHERE referrer_telegram_user_id = ? AND status = 'valid'
  `).bind(userId).first();

  const count = Number(validCount?.count || 0);
  if (count < VALID_REFERRALS_FOR_REWARD) return;

  const totalRewards = Math.floor(count / VALID_REFERRALS_FOR_REWARD);

  const existingRewards = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM referral_rewards
    WHERE referrer_telegram_user_id = ?
  `).bind(userId).first();
  const alreadyRewarded = Number(existingRewards?.count || 0);

  if (totalRewards <= alreadyRewarded) return;

  const entitlement = await getEntitlement(env, userId);
  const now = nowIso();
  const baseTime = entitlement.subscription_expires_at && entitlement.plan === "pro"
    ? new Date(entitlement.subscription_expires_at).getTime()
    : Date.now();
  const expiresAt = new Date(baseTime + REWARD_PRO_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const subscriptionId = crypto.randomUUID();
  const rewardId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO subscriptions (
        id, telegram_user_id, plan, status, starts_at, expires_at,
        source, created_at, updated_at
      ) VALUES (?, ?, 'pro', 'active', ?, ?, 'referral_reward', ?, ?)
    `).bind(subscriptionId, userId, now, expiresAt, now, now),
    env.DB.prepare(`
      INSERT INTO referral_rewards (id, referrer_telegram_user_id, subscription_id, referrals_count, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(rewardId, userId, subscriptionId, count, now),
    env.DB.prepare(`
      UPDATE alerts SET plan_snapshot = 'pro', check_interval_seconds = 60,
        next_check_at = ?, updated_at = ?
      WHERE telegram_user_id = ? AND lifecycle_state IN ('active', 'paused')
    `).bind(now, now, userId),
  ]);

  logEvent("referral_reward_granted", {
    referrer_id: userId,
    referrals_count: count,
    expires_at: expiresAt,
  });

  await sendMessage(
    env,
    userId,
    `🎉 تبریک! ${count} نفر از دوستانت از طریق لینک دعوت تو عضو شدند و هشدار ساختند.\n\n` +
    `🎁 ۷ روز پلن Pro رایگان به اکانتت اضافه شد!\n` +
    `تا تاریخ ${new Date(expiresAt).toLocaleDateString("fa-IR")} فعال است.`,
  );
}

// ── Marketing Channel Posting ─────────────────────────────────────────

export function validateMarketingConfig(env) {
  const warnings = [];
  const enabled = String(env.MARKETING_POSTING_ENABLED || "false").toLowerCase() === "true";

  if (enabled && !env.MARKETING_CHANNEL_ID) {
    warnings.push("MARKETING_CHANNEL_ID is required when MARKETING_POSTING_ENABLED=true");
    logWarn("marketing_missing_channel_id", { marketing_posting_enabled: "true" });
  }

  if (!env.BOT_USERNAME) {
    warnings.push("BOT_USERNAME is not set — referral links and marketing deep links will use fallback text");
  }

  return { enabled, warnings };
}

export async function shouldPostDailyMarketing(env, now) {
  const { enabled, warnings } = validateMarketingConfig(env);
  if (!enabled) return false;
  if (!env.MARKETING_CHANNEL_ID) return false;
  if (!hasProductDb(env)) return false;

  const { hour } = getTehranDateHour(now);
  const configuredHour = getMarketingPostHour(env);
  if (hour !== configuredHour) return false;

  return true;
}

export async function hasPostedTodayCampaign(env, campaignSource) {
  if (!hasProductDb(env)) return false;
  const row = await env.DB.prepare(`
    SELECT 1 FROM marketing_posts WHERE campaign_source = ?
  `).bind(campaignSource).first();
  return Boolean(row);
}

export async function recordMarketingPost(env, campaignSource, channelMessageId) {
  if (!hasProductDb(env)) return;
  const now = nowIso();
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO marketing_posts (id, campaign_source, channel_message_id, posted_at, content_hash)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, campaignSource, channelMessageId || null, now, campaignSource).run();
}

export async function buildDailyMarketingPost(env, now) {
  const campaignSource = getDailyMarketingCampaignId(now);

  if (await hasPostedTodayCampaign(env, campaignSource)) {
    return null;
  }

  let cryptoPrices, iranPrices;
  try {
    [cryptoPrices, iranPrices] = await Promise.all([getCryptoPrices(), getIranMarketPrices()]);
  } catch (error) {
    logError("marketing_price_fetch_failed", { error_message: error?.message });
    return null;
  }

  const { date } = getTehranDateHour(now);
  const btcPrice = cryptoPrices?.BTC != null ? `$${formatPrice(cryptoPrices.BTC)}` : "نامشخص";
  const ethPrice = cryptoPrices?.ETH != null ? `$${formatPrice(cryptoPrices.ETH)}` : "نامشخص";
  const usdPrice = iranPrices?.USD != null ? `${formatPrice(iranPrices?.USD)} تومان` : "نامشخص";
  const goldPrice = iranPrices?.GOLD_18K != null ? `${formatPrice(iranPrices?.GOLD_18K)} تومان` : "نامشخص";

  const ctaLine = env.BOT_USERNAME
    ? `https://t.me/${env.BOT_USERNAME}?start=${campaignSource}`
    : "بات هشدار قیمت نواکس";

  const text = `📊 گزارش روزانه بازار — ${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}

₿ بیت‌کوین: ${btcPrice}
♦ اتریوم: ${ethPrice}
💵 دلار: ${usdPrice}
🪙 طلای ۱۸ عیار: ${goldPrice}

🔔 هشدار قیمت تنظیم کن و از تغییرات جا نمونا!

${ctaLine}`;

  return { text, campaignSource };
}

export async function sendDailyMarketingPost(env, now) {
  if (!(await shouldPostDailyMarketing(env, now))) return null;

  const post = await buildDailyMarketingPost(env, now);
  if (!post) return null;

  try {
    const { result } = await sendMessage(env, env.MARKETING_CHANNEL_ID, post.text);
    await recordMarketingPost(env, post.campaignSource, result?.result?.message_id ? String(result.result.message_id) : null);
    logEvent("marketing_post_sent", { campaign_source: post.campaignSource });
    return post.campaignSource;
  } catch (error) {
    logError("marketing_post_failed", { error_message: error?.message, campaign_source: post.campaignSource });
    return null;
  }
}

// ── Growth Analytics ──────────────────────────────────────────────────

export async function getGrowthStats(env, now) {
  if (!hasProductDb(env)) return null;

  const totalUsers = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM users
  `).first();

  const usersToday = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM users WHERE created_at >= datetime('now', '-1 day')
  `).first();

  const usersThisWeek = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM users WHERE created_at >= datetime('now', '-7 days')
  `).first();

  const campaignVisits = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM user_campaigns
  `).first();

  const topSources = await env.DB.prepare(`
    SELECT first_source, COUNT(*) AS count FROM user_campaigns
    GROUP BY first_source ORDER BY count DESC LIMIT 5
  `).all();

  const usersBySource = await env.DB.prepare(`
    SELECT latest_source, COUNT(*) AS count FROM user_campaigns
    GROUP BY latest_source ORDER BY count DESC LIMIT 5
  `).all();

  const totalAlerts = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM alerts
  `).first();

  const activeAlerts = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM alerts WHERE lifecycle_state = 'active'
  `).first();

  const alertsToday = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM alerts WHERE created_at >= datetime('now', '-1 day')
  `).first();

  const usersWithAlerts = await env.DB.prepare(`
    SELECT COUNT(DISTINCT telegram_user_id) AS count FROM alerts
    WHERE lifecycle_state IN ('active', 'delivered', 'paused')
  `).first();

  const confirmedAlertsBySource = await env.DB.prepare(`
    SELECT uc.first_source, COUNT(DISTINCT a.telegram_user_id) AS user_count, COUNT(a.id) AS alert_count
    FROM user_campaigns uc
    JOIN alerts a ON a.telegram_user_id = uc.telegram_user_id
    WHERE a.lifecycle_state IN ('active', 'delivered', 'paused')
    GROUP BY uc.first_source
    ORDER BY alert_count DESC
    LIMIT 5
  `).all();

  const totalPro = await env.DB.prepare(`
    SELECT COUNT(DISTINCT telegram_user_id) AS count FROM subscriptions WHERE status = 'active'
  `).first();

  const proUpgradedToday = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM subscriptions
    WHERE status = 'active' AND created_at >= datetime('now', '-1 day')
  `).first();

  const totalReferrals = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM referrals WHERE status = 'valid'
  `).first();

  const pendingReferrals = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM referrals WHERE status = 'pending'
  `).first();

  const referralConversions = await env.DB.prepare(`
    SELECT COUNT(DISTINCT r.invited_telegram_user_id) AS count
    FROM referrals r
    JOIN alerts a ON a.telegram_user_id = r.invited_telegram_user_id
    WHERE r.status = 'valid' AND a.lifecycle_state IN ('active', 'delivered')
  `).first();

  const rewardedReferrers = await env.DB.prepare(`
    SELECT COUNT(DISTINCT referrer_telegram_user_id) AS count FROM referral_rewards
  `).first();

  const totalRewards = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM referral_rewards
  `).first();

  const pendingPayments = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM payment_requests WHERE status = 'pending'
  `).first();

  const todayCampaign = getDailyMarketingCampaignId(now);
  const todayPost = await env.DB.prepare(`
    SELECT 1 FROM marketing_posts WHERE campaign_source = ?
  `).bind(todayCampaign).first();

  const usersTotal = Number(totalUsers?.count || 0);
  const withAlerts = Number(usersWithAlerts?.count || 0);
  const proUsers = Number(totalPro?.count || 0);

  return {
    totalUsers: usersTotal,
    usersToday: Number(usersToday?.count || 0),
    usersThisWeek: Number(usersThisWeek?.count || 0),
    campaignVisits: Number(campaignVisits?.count || 0),
    topSources: topSources?.results || [],
    usersBySource: usersBySource?.results || [],
    totalAlerts: Number(totalAlerts?.count || 0),
    activeAlerts: Number(activeAlerts?.count || 0),
    alertsToday: Number(alertsToday?.count || 0),
    usersWithAlerts: withAlerts,
    confirmedAlertsBySource: confirmedAlertsBySource?.results || [],
    totalPro: proUsers,
    proUpgradedToday: Number(proUpgradedToday?.count || 0),
    pendingPayments: Number(pendingPayments?.count || 0),
    totalReferrals: Number(totalReferrals?.count || 0),
    pendingReferrals: Number(pendingReferrals?.count || 0),
    referralConversions: Number(referralConversions?.count || 0),
    rewardedReferrers: Number(rewardedReferrers?.count || 0),
    totalRewards: Number(totalRewards?.count || 0),
    marketingTodayPosted: Boolean(todayPost),
    marketingTodayCampaign: todayCampaign,
    funnel: {
      started: usersTotal,
      createdAlert: withAlerts,
      upgradedToPro: proUsers,
      startToAlertRate: usersTotal > 0 ? ((withAlerts / usersTotal) * 100).toFixed(1) : "0.0",
      alertToProRate: withAlerts > 0 ? ((proUsers / withAlerts) * 100).toFixed(1) : "0.0",
      overallConversion: usersTotal > 0 ? ((proUsers / usersTotal) * 100).toFixed(1) : "0.0",
    },
  };
}

export async function handleGrowthCommand(env, chatId) {
  if (!hasProductDb(env)) {
    await sendMessage(env, chatId, "آمار رشد در دسترس نیست (D1 موجود نیست).");
    return;
  }

  const now = new Date();
  const stats = await getGrowthStats(env, now);
  if (!stats) {
    await sendMessage(env, chatId, "خطا در دریافت آمار رشد.");
    return;
  }

  const { enabled: marketingEnabled, warnings: configWarnings } = validateMarketingConfig(env);
  const marketingHour = getMarketingPostHour(env);
  const { hour: currentHour } = getTehranDateHour(now);

  const topSourcesText = stats.topSources.length
    ? stats.topSources.map((s) => `  • ${s.first_source}: ${s.count}`).join("\n")
    : "  — بدون داده";

  const alertsBySourceText = stats.confirmedAlertsBySource.length
    ? stats.confirmedAlertsBySource.map((s) => `  • ${s.first_source}: ${s.alert_count} هشدار (${s.user_count} کاربر)`).join("\n")
    : "  — بدون داده";

  const marketingStatus = marketingEnabled
    ? `  ✅ فعال ( ساعت ${marketingHour} — ساعت فعلی: ${currentHour} )
  • پست امروز: ${stats.marketingTodayPosted ? "✅ ارسال شده" : "⏳ در انتظار"}`
    : "  ⏸ غیرفعال";

  const warningsText = configWarnings.length
    ? `\n⚠️ هشدارهای پیکربندی:\n${configWarnings.map((w) => `  • ${w}`).join("\n")}`
    : "";

  const f = stats.funnel;
  const funnelText = [
    `📊 قیف تبدیل:`,
    `  👥 شروع: ${f.started}`,
    `  🔔 هشدار ساخت: ${f.createdAlert} (${f.startToAlertRate}%)`,
    `  💎 Pro: ${f.upgradedToPro} (${f.alertToProRate}% از هشدارسازا — ${f.overallConversion}% کل)`,
  ].join("\n");

  const trendsText = [
    `📅 روند روزانه:`,
    `  کاربران جدید — امروز: ${stats.usersToday} | هفته: ${stats.usersThisWeek}`,
    `  هشدارهای جدید امروز: ${stats.alertsToday}`,
    `  ارتقا به Pro امروز: ${stats.proUpgradedToday}`,
  ].join("\n");

  const text = `📈 آمار رشد

${funnelText}

${trendsText}

👥 کل کاربران: ${stats.totalUsers}
🔔 هشدارها: ${stats.totalAlerts} کل (${stats.activeAlerts} فعال — ${stats.usersWithAlerts} کاربر)
💎 کاربران Pro: ${stats.totalPro}
🧾 پرداخت‌های در انتظار: ${stats.pendingPayments}
🔗 بازدید کمپین: ${stats.campaignVisits}

📌 منابع ورودی (اولین لمس):
${topSourcesText}

🔔 هشدارهای تأییدشده بر اساس منبع:
${alertsBySourceText}

🤝 دعوت‌ها:
  • معتبر: ${stats.totalReferrals}
  • در انتظار: ${stats.pendingReferrals}
  • تبدیل‌شده (هشدار ساخته): ${stats.referralConversions}
  • پاداش دریافت‌کرده: ${stats.rewardedReferrers} کاربر (${stats.totalRewards} جایزه)

📣 پست روزانه کانال:
${marketingStatus}${warningsText}`;

  await sendMessage(env, chatId, text);
}

export async function sendDailySummary(env) {
  if (!hasProductDb(env)) return;
  const adminChatId = env.ADMIN_CHAT_ID;
  if (!adminChatId) {
    logWarn("daily_summary_skipped", { reason: "ADMIN_CHAT_ID not configured" });
    return;
  }

  const now = new Date();
  const { hour } = getTehranDateHour(now);
  const stats = await getGrowthStats(env, now);
  if (!stats) return;

  const f = stats.funnel;
  const text = [
    `📋 *گزارش روزانه — ${now.toLocaleDateString("fa-IR")}*`,
    ``,
    `▫️ *کاربران*`,
    `  مجموع: ${stats.totalUsers}`,
    `  جدید امروز: ${stats.usersToday} | هفته: ${stats.usersThisWeek}`,
    ``,
    `▫️ *هشدارها*`,
    `  مجموع: ${stats.totalAlerts}`,
    `  فعال: ${stats.activeAlerts}`,
    `  جدید امروز: ${stats.alertsToday}`,
    ``,
    `▫️ *قیف تبدیل*`,
    `  شروع → هشدار: ${f.startToAlertRate}%`,
    `  هشدار → Pro: ${f.alertToProRate}%`,
    `  تبدیل کلی: ${f.overallConversion}%`,
    ``,
    `▫️ *اشتراک*`,
    `  کاربران Pro: ${stats.totalPro}`,
    `  ارتقا امروز: ${stats.proUpgradedToday}`,
    `  پرداخت‌های pending: ${stats.pendingPayments}`,
    ``,
    `▫️ *دعوت‌ها*`,
    `  معتبر: ${stats.totalReferrals}`,
    `  در انتظار: ${stats.pendingReferrals}`,
    `  پاداش داده شده: ${stats.totalRewards}`,
    ``,
    `▫️ *بازاریابی*`,
    `  پست امروز: ${stats.marketingTodayPosted ? "✅ ارسال شد" : "⏳ نشده"}`,
  ].join("\n");

  await sendMessage(env, adminChatId, text);
  logEvent("daily_summary_sent", { admin_chat_id: adminChatId, hour });
}

export async function getReferralLink(env, telegramUserId) {
  const botUsername = env.BOT_USERNAME || "";
  if (!botUsername) return null;
  return `https://t.me/${botUsername}?start=ref_${telegramUserId}`;
}

export function referralInfoText(referralLink, referralCount) {
  if (!referralLink) return "";
  return `🎁 لینک دعوت دوستان:

${referralLink}

با اشتراک‌گذاری این لینک، دوستت وارد بات می‌شه و اولین هشدارش رو می‌سازه.
هر ۳ دعوت موفق = ۷ روز پلن Pro رایگان!

تعداد دعوت‌های موفق شما: ${referralCount || 0}`;
}
