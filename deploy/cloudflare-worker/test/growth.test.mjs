import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";

import {
  recordCampaignVisit,
  parseStartParam,
  isReferralSource,
  extractReferrerId,
  isMarketingSource,
  recordReferral,
  validateReferralOnAlert,
  getGrowthStats,
  buildDailyMarketingPost,
  hasPostedTodayCampaign,
  recordMarketingPost,
  referralInfoText,
  getReferralLink,
  getTehranDateHour,
  getMarketingPostHour,
  getDailyMarketingCampaignId,
  shouldPostDailyMarketing,
  validateMarketingConfig,
} from "../src/growth.js";

// ── Shared Test Infrastructure ────────────────────────────────────────

class MockKV extends Map {
  async get(key, type) {
    const val = super.get(key);
    return type === "json" && val ? JSON.parse(val) : val ?? null;
  }
  async put(key, val) {
    super.set(key, val);
  }
  async delete(key) {
    super.delete(key);
  }
  async list({ prefix } = {}) {
    const keys = [];
    for (const k of super.keys()) {
      if (!prefix || k.startsWith(prefix)) keys.push({ name: k });
    }
    return { keys };
  }
}

let sent = [];
let telegramMode = "ok";

global.fetch = async (url, options) => {
  const u = String(url);
  let hostname = "";
  try {
    hostname = new URL(u).hostname;
  } catch {
    hostname = "";
  }

  if (hostname === "api.telegram.org") {
    const method = u.split("/").pop();
    const body = options?.body ? JSON.parse(options.body) : {};
    sent.push({ method, ...body });
    if (telegramMode === "fail" && method === "sendMessage") {
      return {
        ok: false,
        status: 429,
        json: async () => ({ ok: false, error_code: 429, description: "Too Many Requests" }),
      };
    }
    return { ok: true, json: async () => ({ ok: true, result: { message_id: sent.length } }) };
  }

  if (
    hostname === "api.binance.com" ||
    hostname === "data-api.binance.vision" ||
    hostname.endsWith(".binance.com") ||
    hostname.endsWith(".binance.vision")
  ) {
    return {
      ok: true,
      json: async () => [
        { symbol: "BTCUSDT", price: "67240.00" },
        { symbol: "ETHUSDT", price: "3420.00" },
        { symbol: "SOLUSDT", price: "165.00" },
        { symbol: "BNBUSDT", price: "590.00" },
      ],
    };
  }

  if (hostname === "api.coingecko.com") {
    return {
      ok: true,
      json: async () => ({
        bitcoin: { usd: 67240 },
        ethereum: { usd: 3420 },
        solana: { usd: 165 },
        binancecoin: { usd: 590 },
      }),
    };
  }

  if (hostname === "tgju.org" || hostname.endsWith(".tgju.org")) {
    return {
      ok: true,
      json: async () => ({
        current: {
          price_dollar_rl: { p: "1,700,000" },
          price_eur: { p: "1,850,000" },
          geram18: { p: "35,000,000" },
          sekee: { p: "400,000,000" },
        },
      }),
    };
  }

  return { ok: true, json: async () => ({}) };
};

// ── D1 Setup ──────────────────────────────────────────────────────────

async function setupD1() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });
  const DB = await mf.getD1Database("DB");

  const migration001 = await readFile(
    new URL("../migrations/0001_product_core.sql", import.meta.url),
    "utf8",
  );
  for (const statement of migration001.split(";").map((p) => p.trim()).filter(Boolean)) {
    await DB.prepare(statement).run();
  }

  const migration002 = await readFile(
    new URL("../migrations/0002_growth_campaign.sql", import.meta.url),
    "utf8",
  );
  for (const statement of migration002.split(";").map((p) => p.trim()).filter(Boolean)) {
    await DB.prepare(statement).run();
  }

  return { mf, DB };
}

function seedUser(DB, userId, overrides = {}) {
  const now = new Date().toISOString();
  return DB.prepare(`
    INSERT INTO users (telegram_user_id, username, first_name, last_name, language_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    String(userId),
    overrides.username || `user${userId}`,
    overrides.first_name || `User ${userId}`,
    null,
    "fa",
    overrides.created_at || now,
    now,
  ).run();
}

function seedUserAndAlert(DB, userId, alertId) {
  const now = new Date().toISOString();
  return DB.batch([
    DB.prepare(`
      INSERT OR IGNORE INTO users (telegram_user_id, created_at, updated_at)
      VALUES (?, ?, ?)
    `).bind(String(userId), now, now),
    DB.prepare(`
      INSERT INTO alerts (
        id, telegram_user_id, canonical_asset_id, market, symbol,
        display_asset_name_at_creation, condition_type, target_price,
        target_price_display_unit, lifecycle_state, enabled, plan_snapshot,
        check_interval_seconds, cooldown_minutes, attempt_count, max_attempts,
        version, created_at, confirmed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 'free', 600, 60, 0, 3, 1, ?, ?, ?)
    `).bind(
      alertId,
      String(userId),
      "crypto:BTC",
      "crypto",
      "BTC",
      "بیت‌کوین (BTC)",
      "above",
      70000,
      "USDT",
      now,
      now,
      now,
    ),
  ]);
}

// Helper: create a Date fixed to a specific Tehran hour for testing
function fakeDateAtTehranHour(year, month, day, hour) {
  // Tehran is UTC+3:30. Tehran hour H at :00 = UTC (H-4):30.
  // E.g. Tehran 10:00 = UTC 06:30. Tehran 09:00 = UTC 05:30.
  const utcHour = hour - 4;
  const utcMinute = 30;
  return new Date(Date.UTC(year, month - 1, day, utcHour, utcMinute, 0));
}

// ── Tests ─────────────────────────────────────────────────────────────

let testsPassed = 0;

// ─── Parsing & Source Detection ───────────────────────────────────────

// Test 1: parseStartParam
{
  assert.equal(parseStartParam("/start post_daily_20260702"), "post_daily_20260702");
  assert.equal(parseStartParam("/start ref_12345"), "ref_12345");
  assert.equal(parseStartParam("/start"), null);
  assert.equal(parseStartParam("/startabc"), null);
  assert.equal(parseStartParam(""), null);
  assert.equal(parseStartParam(null), null);
  testsPassed++;
  console.log("  ✓ parseStartParam");
}

// Test 2: isReferralSource
{
  assert.equal(isReferralSource("ref_12345"), true);
  assert.equal(isReferralSource("ref_0"), true);
  assert.equal(isReferralSource("post_daily_20260702"), false);
  assert.equal(isReferralSource("ad_crypto_001"), false);
  assert.equal(isReferralSource(""), false);
  assert.equal(isReferralSource(null), false);
  testsPassed++;
  console.log("  ✓ isReferralSource");
}

// Test 3: extractReferrerId
{
  assert.equal(extractReferrerId("ref_12345"), "12345");
  assert.equal(extractReferrerId("ref_0"), "0");
  assert.equal(extractReferrerId("post_daily_20260702"), null);
  assert.equal(extractReferrerId(null), null);
  testsPassed++;
  console.log("  ✓ extractReferrerId");
}

// Test 4: isMarketingSource
{
  assert.equal(isMarketingSource("post_daily_20260702"), true);
  assert.equal(isMarketingSource("ref_12345"), false);
  assert.equal(isMarketingSource(""), false);
  assert.equal(isMarketingSource(null), false);
  testsPassed++;
  console.log("  ✓ isMarketingSource");
}

// ─── Tehran Time Helpers ──────────────────────────────────────────────

// Test 5: getTehranDateHour
{
  // 2026-01-15T06:30:00Z = 2026-01-15T10:00:00+03:30
  const d = new Date(Date.UTC(2026, 0, 15, 6, 30, 0));
  const result = getTehranDateHour(d);
  assert.equal(result.date, "20260115");
  assert.equal(result.hour, 10);

  // 2026-07-02T20:00:00Z = 2026-07-02T23:30:00+03:30
  const d2 = new Date(Date.UTC(2026, 6, 2, 20, 0, 0));
  const r2 = getTehranDateHour(d2);
  assert.equal(r2.date, "20260702");
  assert.equal(r2.hour, 23);
  testsPassed++;
  console.log("  ✓ getTehranDateHour");
}

// Test 6: getMarketingPostHour
{
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "10" }), 10);
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "0" }), 0);
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "23" }), 23);
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "" }), 10, "empty falls back to default");
  assert.equal(getMarketingPostHour({}), 10, "missing falls back to default");
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "25" }), 10, "out of range falls back");
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "abc" }), 10, "non-numeric falls back");
  assert.equal(getMarketingPostHour({ MARKETING_POST_HOUR_TEHRAN: "10.5" }), 10, "fractional falls back");
  testsPassed++;
  console.log("  ✓ getMarketingPostHour (valid/invalid/default)");
}

// Test 7: getDailyMarketingCampaignId
{
  const now = new Date(Date.UTC(2026, 6, 2, 6, 30, 0)); // Tehran: 2026-07-02 10:00
  assert.equal(getDailyMarketingCampaignId(now), "post_daily_20260702");

  const now2 = new Date(Date.UTC(2026, 11, 31, 20, 0, 0)); // Tehran: 2026-12-31 23:30
  assert.equal(getDailyMarketingCampaignId(now2), "post_daily_20261231");
  testsPassed++;
  console.log("  ✓ getDailyMarketingCampaignId (Tehran date)");
}

// ─── Campaign Persistence ─────────────────────────────────────────────

// Test 8: Campaign persistence via D1
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 100);

    await recordCampaignVisit(env, 100, "post_daily_20260702");
    let row = await DB.prepare("SELECT * FROM user_campaigns WHERE telegram_user_id = ?").bind("100").first();
    assert.equal(row.first_source, "post_daily_20260702");
    assert.equal(row.latest_source, "post_daily_20260702");

    await recordCampaignVisit(env, 100, "ad_crypto_001");
    row = await DB.prepare("SELECT * FROM user_campaigns WHERE telegram_user_id = ?").bind("100").first();
    assert.equal(row.first_source, "post_daily_20260702", "first_source immutable");
    assert.equal(row.latest_source, "ad_crypto_001", "latest_source updates");

    await recordCampaignVisit(env, 100, "ref_999");
    row = await DB.prepare("SELECT * FROM user_campaigns WHERE telegram_user_id = ?").bind("100").first();
    assert.equal(row.first_source, "post_daily_20260702");
    assert.equal(row.latest_source, "ref_999");

    testsPassed++;
    console.log("  ✓ campaign persistence (first-touch immutable, latest-touch updates)");
  } finally {
    await mf.dispose();
  }
}

// Test 9: Campaign persistence is a no-op without D1
{
  await recordCampaignVisit({ DB: null }, 200, "post_daily_20260702");
  testsPassed++;
  console.log("  ✓ campaign persistence without D1 is no-op");
}

// ─── Referral System ──────────────────────────────────────────────────

// Test 10: Referral attribution (valid new user)
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 500);
    await seedUser(DB, 600);

    const referralId = await recordReferral(env, 500, 600);
    assert.ok(referralId, "should create referral");

    const row = await DB.prepare("SELECT * FROM referrals WHERE id = ?").bind(referralId).first();
    assert.equal(row.referrer_telegram_user_id, "500");
    assert.equal(row.invited_telegram_user_id, "600");
    assert.equal(row.status, "pending");

    testsPassed++;
    console.log("  ✓ referral attribution (valid new user)");
  } finally {
    await mf.dispose();
  }
}

// Test 11: Self-referral rejection
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 700);
    await seedUserAndAlert(DB, 700, "self-ref-alert");

    const referralId = await recordReferral(env, 700, 700);
    assert.ok(referralId, "recordReferral creates row (rejected at validation)");

    const result = await validateReferralOnAlert(env, 700);
    assert.equal(result, null, "self-referral rejected");

    const row = await DB.prepare("SELECT * FROM referrals WHERE invited_telegram_user_id = ?").bind("700").first();
    assert.equal(row.status, "rejected");

    testsPassed++;
    console.log("  ✓ self-referral rejection");
  } finally {
    await mf.dispose();
  }
}

// Test 12: Duplicate referral prevention
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 800);
    await seedUser(DB, 801);
    await seedUser(DB, 802);

    const first = await recordReferral(env, 800, 801);
    assert.ok(first, "first referral succeeds");

    const duplicate = await recordReferral(env, 802, 801);
    assert.equal(duplicate, null, "duplicate returns null");

    testsPassed++;
    console.log("  ✓ duplicate referral prevention");
  } finally {
    await mf.dispose();
  }
}

// Test 13: Referral validation only after confirmed alert
// The gating happens in callbacks.js (validateReferralOnAlert is only called after createAlert).
// Here we test that the function correctly validates a pending referral and that
// calling it again (already valid) is a no-op.
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 900);
    await seedUser(DB, 901);
    await recordReferral(env, 900, 901);

    // First call: pending -> valid
    await seedUserAndAlert(DB, 901, "ref-alert-1");
    const referrer = await validateReferralOnAlert(env, 901);
    assert.equal(referrer, "900", "should return referrer after validation");

    const row = await DB.prepare("SELECT * FROM referrals WHERE invited_telegram_user_id = ?").bind("901").first();
    assert.equal(row.status, "valid");
    assert.ok(row.validated_at);

    // Second call: already valid -> no-op
    const secondCall = await validateReferralOnAlert(env, 901);
    assert.equal(secondCall, null, "second validation should be no-op");

    testsPassed++;
    console.log("  ✓ referral validation on confirmed alert");
  } finally {
    await mf.dispose();
  }
}

// Test 14: Referral validation no-op for user without pending referral
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 950);

    const result = await validateReferralOnAlert(env, 950);
    assert.equal(result, null, "no pending referral returns null");

    testsPassed++;
    console.log("  ✓ referral validation no-op for user without pending referral");
  } finally {
    await mf.dispose();
  }
}

// ─── Referral Rewards ─────────────────────────────────────────────────

// Test 15: Reward after 3 valid referrals
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB, BOT_USERNAME: "test_bot", TELEGRAM_BOT_TOKEN: "test_token" };
    sent = [];

    await seedUser(DB, 1000);
    for (let i = 1; i <= 3; i++) {
      await seedUser(DB, 1100 + i);
      await recordReferral(env, 1000, 1100 + i);
    }
    for (let i = 1; i <= 3; i++) {
      await seedUserAndAlert(DB, 1100 + i, `reward-alert-${i}`);
      await validateReferralOnAlert(env, 1100 + i);
    }

    const sub = await DB.prepare(`
      SELECT * FROM subscriptions WHERE telegram_user_id = ? AND source = 'referral_reward'
    `).bind("1000").first();
    assert.ok(sub, "should create reward subscription");
    assert.equal(sub.plan, "pro");
    assert.equal(sub.status, "active");

    const reward = await DB.prepare(`
      SELECT * FROM referral_rewards WHERE referrer_telegram_user_id = ?
    `).bind("1000").first();
    assert.ok(reward, "should record reward");
    assert.equal(Number(reward.referrals_count), 3);

    const proNotif = sent.find(
      (s) => s.method === "sendMessage" && String(s.chat_id) === "1000" && String(s.text).includes("۷ روز پلن Pro"),
    );
    assert.ok(proNotif, "should send Pro notification");

    testsPassed++;
    console.log("  ✓ reward after 3 valid referrals");
  } finally {
    await mf.dispose();
  }
}

// Test 16: No duplicate reward
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB, BOT_USERNAME: "test_bot", TELEGRAM_BOT_TOKEN: "test_token" };
    sent = [];

    await seedUser(DB, 2000);
    for (let i = 1; i <= 3; i++) {
      await seedUser(DB, 2100 + i);
      await recordReferral(env, 2000, 2100 + i);
      await seedUserAndAlert(DB, 2100 + i, `dup-reward-alert-${i}`);
      await validateReferralOnAlert(env, 2100 + i);
    }

    const count1 = (await DB.prepare(
      "SELECT COUNT(*) AS count FROM referral_rewards WHERE referrer_telegram_user_id = ?",
    ).bind("2000").first()).count;

    for (let i = 1; i <= 3; i++) {
      await validateReferralOnAlert(env, 2100 + i);
    }

    const count2 = (await DB.prepare(
      "SELECT COUNT(*) AS count FROM referral_rewards WHERE referrer_telegram_user_id = ?",
    ).bind("2000").first()).count;

    assert.equal(count1, count2, "no duplicate rewards");
    testsPassed++;
    console.log("  ✓ no duplicate reward for same referral count");
  } finally {
    await mf.dispose();
  }
}

// ─── Marketing: Config Validation ─────────────────────────────────────

// Test 17: Marketing disabled mode
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB, MARKETING_POSTING_ENABLED: "false", MARKETING_CHANNEL_ID: "-100123" };
    const shouldPost = await shouldPostDailyMarketing(env, new Date());
    assert.equal(shouldPost, false, "disabled should not post");
    testsPassed++;
    console.log("  ✓ marketing disabled mode");
  } finally {
    await mf.dispose();
  }
}

// Test 18: Marketing without channel ID
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB, MARKETING_POSTING_ENABLED: "true" };
    const shouldPost = await shouldPostDailyMarketing(env, new Date());
    assert.equal(shouldPost, false, "missing channel ID should not post");
    testsPassed++;
    console.log("  ✓ marketing without channel ID");
  } finally {
    await mf.dispose();
  }
}

// Test 19: validateMarketingConfig warnings
{
  const { warnings } = validateMarketingConfig({ MARKETING_POSTING_ENABLED: "true" });
  assert.ok(warnings.some((w) => w.includes("MARKETING_CHANNEL_ID")), "should warn about missing channel ID");

  const { warnings: w2 } = validateMarketingConfig({});
  assert.ok(w2.some((w) => w.includes("BOT_USERNAME")), "should warn about missing BOT_USERNAME");

  const { enabled } = validateMarketingConfig({ MARKETING_POSTING_ENABLED: "false" });
  assert.equal(enabled, false, "disabled when false");

  const { enabled: en } = validateMarketingConfig({});
  assert.equal(en, false, "disabled by default");
  testsPassed++;
  console.log("  ✓ validateMarketingConfig (warnings + defaults)");
}

// ─── Marketing: Tehran Hour Gating ────────────────────────────────────

// Test 20: does NOT post before configured Tehran hour
{
  const { mf, DB } = await setupD1();
  try {
    const env = {
      DB,
      MARKETING_POSTING_ENABLED: "true",
      MARKETING_CHANNEL_ID: "-100123",
      BOT_USERNAME: "test_bot",
      MARKETING_POST_HOUR_TEHRAN: "10",
    };
    // Tehran hour 9 (before configured hour 10)
    const beforeHour = fakeDateAtTehranHour(2026, 7, 2, 9);
    const shouldPost = await shouldPostDailyMarketing(env, beforeHour);
    assert.equal(shouldPost, false, "should not post before configured Tehran hour");
    testsPassed++;
    console.log("  ✓ does NOT post before configured Tehran hour");
  } finally {
    await mf.dispose();
  }
}

// Test 21: posts at configured Tehran hour
{
  const { mf, DB } = await setupD1();
  try {
    const env = {
      DB,
      MARKETING_POSTING_ENABLED: "true",
      MARKETING_CHANNEL_ID: "-100123",
      BOT_USERNAME: "test_bot",
      MARKETING_POST_HOUR_TEHRAN: "10",
    };
    const atHour = fakeDateAtTehranHour(2026, 7, 2, 10);
    const shouldPost = await shouldPostDailyMarketing(env, atHour);
    assert.equal(shouldPost, true, "should post at configured Tehran hour");
    testsPassed++;
    console.log("  ✓ posts at configured Tehran hour");
  } finally {
    await mf.dispose();
  }
}

// Test 22: does NOT post after configured hour (already posted or wrong hour)
{
  const { mf, DB } = await setupD1();
  try {
    const env = {
      DB,
      MARKETING_POSTING_ENABLED: "true",
      MARKETING_CHANNEL_ID: "-100123",
      BOT_USERNAME: "test_bot",
      MARKETING_POST_HOUR_TEHRAN: "10",
    };
    const afterHour = fakeDateAtTehranHour(2026, 7, 2, 11);
    const shouldPost = await shouldPostDailyMarketing(env, afterHour);
    assert.equal(shouldPost, false, "should not post after configured hour");
    testsPassed++;
    console.log("  ✓ does NOT post after configured Tehran hour");
  } finally {
    await mf.dispose();
  }
}

// Test 23: does NOT post twice on same Tehran date
{
  const { mf, DB } = await setupD1();
  try {
    const env = {
      DB,
      MARKETING_POSTING_ENABLED: "true",
      MARKETING_CHANNEL_ID: "-100123",
      BOT_USERNAME: "test_bot",
      MARKETING_POST_HOUR_TEHRAN: "10",
    };

    const atHour = fakeDateAtTehranHour(2026, 7, 2, 10);

    const post1 = await buildDailyMarketingPost(env, atHour);
    assert.ok(post1, "first build should succeed");

    await recordMarketingPost(env, post1.campaignSource, "msg_1");

    const post2 = await buildDailyMarketingPost(env, atHour);
    assert.equal(post2, null, "second build should return null (idempotent)");
    testsPassed++;
    console.log("  ✓ does NOT post twice on same Tehran date");
  } finally {
    await mf.dispose();
  }
}

// Test 24: UTC/Tehran date boundary — different UTC dates may map to same Tehran date
{
  // UTC 2026-07-02T00:00:00 = Tehran 2026-07-02T03:30:00 (same Tehran date as hour 10)
  const earlyTehran = new Date(Date.UTC(2026, 6, 2, 0, 0, 0));
  const { date: date1 } = getTehranDateHour(earlyTehran);
  assert.equal(date1, "20260702", "UTC July 2 00:00 = Tehran July 2 03:30");

  const lateTehran = new Date(Date.UTC(2026, 6, 2, 6, 30, 0));
  const { date: date2 } = getTehranDateHour(lateTehran);
  assert.equal(date2, "20260702", "UTC July 2 06:30 = Tehran July 2 10:00");

  assert.equal(date1, date2, "both should map to same Tehran date");

  // Verify Tehran date wraps after 20:30 UTC
  const wrapTehran = new Date(Date.UTC(2026, 6, 2, 20, 30, 0));
  const { date: date3, hour: hour3 } = getTehranDateHour(wrapTehran);
  assert.equal(date3, "20260703", "UTC July 2 20:30 = Tehran July 3 00:00");
  assert.ok(hour3 === 0 || hour3 === 24, "Tehran hour should represent midnight");
  testsPassed++;
  console.log("  ✓ UTC/Tehran date boundary behavior");
}

// ─── Marketing: BOT_USERNAME Enforcement ──────────────────────────────

// Test 25: getReferralLink returns null without BOT_USERNAME
{
  const link = await getReferralLink({ BOT_USERNAME: "" }, "12345");
  assert.equal(link, null, "empty BOT_USERNAME returns null");

  const link2 = await getReferralLink({}, "12345");
  assert.equal(link2, null, "missing BOT_USERNAME returns null");

  testsPassed++;
  console.log("  ✓ getReferralLink returns null without BOT_USERNAME");
}

// Test 26: getReferralLink works with BOT_USERNAME
{
  const link = await getReferralLink({ BOT_USERNAME: "novax_price_bot" }, "12345");
  assert.equal(link, "https://t.me/novax_price_bot?start=ref_12345");
  testsPassed++;
  console.log("  ✓ getReferralLink works with BOT_USERNAME");
}

// Test 27: referralInfoText returns empty when no link
{
  const text = referralInfoText(null, 5);
  assert.equal(text, "", "null link returns empty");

  const text2 = referralInfoText(undefined, 5);
  assert.equal(text2, "", "undefined link returns empty");
  testsPassed++;
  console.log("  ✓ referralInfoText returns empty without link");
}

// Test 28: Marketing post CTA uses BOT_USERNAME or fallback
{
  const { mf, DB } = await setupD1();
  try {
    const env = {
      DB,
      MARKETING_POSTING_ENABLED: "true",
      MARKETING_CHANNEL_ID: "-100123",
      BOT_USERNAME: "test_bot",
      MARKETING_POST_HOUR_TEHRAN: "10",
    };
    const now = fakeDateAtTehranHour(2026, 7, 2, 10);
    const post = await buildDailyMarketingPost(env, now);
    assert.ok(post);
    assert.ok(post.text.includes("https://t.me/test_bot?start=post_daily_20260702"), "should include bot deep link");

    // Without BOT_USERNAME
    const envNoBot = { ...env, BOT_USERNAME: "" };
    const postNoBot = await buildDailyMarketingPost(envNoBot, now);
    assert.ok(postNoBot);
    assert.ok(!postNoBot.text.includes("https://t.me/"), "should not include broken link");
    assert.ok(postNoBot.text.includes("بات هشدار قیمت نواکس"), "should use fallback text");
    testsPassed++;
    console.log("  ✓ marketing post CTA uses BOT_USERNAME or fallback");
  } finally {
    await mf.dispose();
  }
}

// ─── Marketing: Idempotency via D1 ───────────────────────────────────

// Test 29: hasPostedTodayCampaign
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };

    const has1 = await hasPostedTodayCampaign(env, "post_daily_20260702");
    assert.equal(has1, false, "no post yet");

    await recordMarketingPost(env, "post_daily_20260702", "msg_1");

    const has2 = await hasPostedTodayCampaign(env, "post_daily_20260702");
    assert.equal(has2, true, "after recording, should detect");

    testsPassed++;
    console.log("  ✓ hasPostedTodayCampaign");
  } finally {
    await mf.dispose();
  }
}

// ─── Growth Stats ─────────────────────────────────────────────────────

// Test 30: Growth stats include marketing status
{
  const { mf, DB } = await setupD1();
  try {
    const env = { DB };
    await seedUser(DB, 3000);
    await recordCampaignVisit(env, 3000, "post_daily_20260701");

    const now = fakeDateAtTehranHour(2026, 7, 2, 10);
    const stats = await getGrowthStats(env, now);
    assert.ok(stats, "should return stats");
    assert.ok(stats.totalUsers >= 1, "should count users");
    assert.ok(typeof stats.marketingTodayPosted === "boolean", "should have marketingTodayPosted");
    assert.equal(stats.marketingTodayCampaign, "post_daily_20260702", "should have today campaign ID");

    testsPassed++;
    console.log("  ✓ growth stats include marketing status");
  } finally {
    await mf.dispose();
  }
}

// ─── Webhook Integration ──────────────────────────────────────────────

// Test 31: /start with marketing source via full worker
{
  const mockEnv = {
    TELEGRAM_BOT_TOKEN: "test_token",
    TELEGRAM_SECRET_TOKEN: "test_secret",
    NOVAX_MINI_APP_URL: "https://worker.example/mini-app/",
    ALERTS_KV: new MockKV(),
    SESSIONS_KV: new MockKV(),
    USERS_KV: new MockKV(),
  };

  const { mf, DB } = await setupD1();
  const d1Env = { ...mockEnv, DB };
  const ctx = { waitUntil() {} };

  let updateId = 1000;
  sent = [];

  async function sendStart(text, chatId = 5000) {
    updateId += 1;
    const update = {
      update_id: updateId,
      message: { chat: { id: chatId }, from: { first_name: "Campaign", id: chatId }, text },
    };
    const req = new Request("https://bot.example/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "test_secret" },
      body: JSON.stringify(update),
    });
    return (await import("../src/index.js")).default.fetch(req, d1Env, ctx);
  }

  // Marketing source
  await sendStart("/start post_daily_20260702");
  const campaignRow = await DB.prepare("SELECT * FROM user_campaigns WHERE telegram_user_id = ?").bind("5000").first();
  assert.ok(campaignRow, "should record campaign");
  assert.equal(campaignRow.first_source, "post_daily_20260702");

  // Referral source (new user)
  await DB.prepare("INSERT OR IGNORE INTO users (telegram_user_id, created_at, updated_at) VALUES (?, ?, ?)")
    .bind("5001", new Date().toISOString(), new Date().toISOString()).run();
  await DB.prepare("INSERT OR IGNORE INTO users (telegram_user_id, created_at, updated_at) VALUES (?, ?, ?)")
    .bind("5002", new Date().toISOString(), new Date().toISOString()).run();
  await recordReferral(d1Env, 5001, 5002);

  await sendStart("/start ref_5001", 5003);
  const referralRow = await DB.prepare("SELECT * FROM referrals WHERE invited_telegram_user_id = ?").bind("5003").first();
  assert.ok(referralRow, "should record referral for new user");
  assert.equal(referralRow.referrer_telegram_user_id, "5001");

  // Plain /start
  await sendStart("/start", 5004);
  const noCampaign = await DB.prepare("SELECT * FROM user_campaigns WHERE telegram_user_id = ?").bind("5004").first();
  assert.equal(noCampaign, null, "plain /start should not record campaign");

  // Self-referral
  await sendStart("/start ref_5005", 5005);
  const selfRef = await DB.prepare("SELECT * FROM referrals WHERE invited_telegram_user_id = ?").bind("5005").first();
  assert.equal(selfRef, null, "self-referral should not be created");

  testsPassed++;
  console.log("  ✓ webhook integration (/start with source params via full worker)");
  await mf.dispose();
}

// ─── /growth admin check ──────────────────────────────────────────────

// Test 32: /growth requires admin
{
  const mockEnv = {
    TELEGRAM_BOT_TOKEN: "test_token",
    TELEGRAM_SECRET_TOKEN: "test_secret",
    ALERTS_KV: new MockKV(),
    SESSIONS_KV: new MockKV(),
    USERS_KV: new MockKV(),
    ADMIN_TELEGRAM_USER_IDS: "99999",
  };

  const { mf, DB } = await setupD1();
  const d1Env = { ...mockEnv, DB };
  const ctx = { waitUntil() {} };

  let updateId = 2000;
  sent = [];

  async function sendCommand(text, chatId) {
    updateId += 1;
    const update = {
      update_id: updateId,
      message: { chat: { id: chatId }, from: { first_name: "Test", id: chatId }, text },
    };
    const req = new Request("https://bot.example/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "test_secret" },
      body: JSON.stringify(update),
    });
    return (await import("../src/index.js")).default.fetch(req, d1Env, ctx);
  }

  // Non-admin
  await sendCommand("/growth", 11111);
  const nonAdminMsg = sent.find((s) => s.method === "sendMessage" && String(s.chat_id) === "11111");
  assert.ok(nonAdminMsg?.text?.includes("ادمین"), "non-admin should get access denied");

  // Admin
  sent = [];
  await sendCommand("/growth", 99999);
  const adminMsg = sent.find((s) => s.method === "sendMessage" && String(s.chat_id) === "99999");
  assert.ok(adminMsg?.text?.includes("آمار رشد"), "admin should get growth stats");

  testsPassed++;
  console.log("  ✓ /growth requires admin");
  await mf.dispose();
}

console.log(`\nGrowth system tests: ${testsPassed} passed`);
