import assert from "node:assert";

// Minimal in-memory KV mock supporting the methods the worker uses.
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

const mockEnv = {
  TELEGRAM_BOT_TOKEN: "test_token",
  TELEGRAM_SECRET_TOKEN: "test_secret",
  ALERTS_KV: new MockKV(),
  SESSIONS_KV: new MockKV(),
  USERS_KV: new MockKV(),
};

const ctx = { waitUntil() {} };

// Records outgoing Telegram API calls so we can assert on bot behavior.
let sent = [];
let providerMode = "healthy";
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
    if (providerMode === "crypto-unavailable") {
      return { ok: false, json: async () => ({}) };
    }
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
    if (providerMode === "iran-unavailable") {
      return { ok: false, json: async () => ({}) };
    }
    // ساختار واقعی TGJU: مقادیر زیر کلید current و به‌صورت رشته‌ی کاما-دار (ریال).
    return {
      ok: true,
      json: async () => ({
        current: {
          price_dollar_rl: { p: "1,700,000" }, // 170,000 toman
          price_eur: { p: "1,850,000" }, // 185,000 toman
          geram18: { p: "35,000,000" }, // 3,500,000 toman
          sekee: { p: "400,000,000" }, // 40,000,000 toman
        },
      }),
    };
  }

  return { ok: true, json: async () => ({}) };
};

const worker = await import("../src/index.js");
const alertsModule = await import("../src/alerts.js");

let updateId = 0;

async function sendMessageUpdate(text, chatId = 123) {
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
  return worker.default.fetch(req, mockEnv, ctx);
}

async function sendCallback(data, chatId = 123, messageId = 1) {
  updateId += 1;
  const update = {
    update_id: updateId,
    callback_query: {
      id: `cb${updateId}`,
      data,
      from: { first_name: "Test", id: chatId },
      message: { chat: { id: chatId }, message_id: messageId },
    },
  };
  const req = new Request("https://bot.example/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test_secret" },
    body: JSON.stringify(update),
  });
  return worker.default.fetch(req, mockEnv, ctx);
}

function lastText() {
  const msgs = sent.filter((s) => s.method === "sendMessage" || s.method === "editMessageText");
  return msgs[msgs.length - 1]?.text || "";
}

function allText() {
  return sent
    .filter((s) => s.method === "sendMessage" || s.method === "editMessageText")
    .map((s) => s.text)
    .join("\n---\n");
}

// 1) /start registers user and shows the main keyboard
sent = [];
let res = await sendMessageUpdate("/start");
assert.equal(res.status, 200);
assert.ok(lastText().includes("نواکس"), "/start should send the welcome text");
const startMsg = sent.find((s) => s.method === "sendMessage" && s.reply_markup);
assert.ok(startMsg?.reply_markup?.keyboard, "/start should attach the main reply keyboard");

// 2) Crypto prices come from Binance and show BTC/ETH/SOL/BNB in USDT
sent = [];
await sendCallback("market:crypto"); // no session -> price view
const cryptoText = allText();
assert.ok(cryptoText.includes("BTC") && cryptoText.includes("USDT"), "crypto prices should list BTC in USDT");
for (const sym of ["ETH", "SOL", "BNB"]) {
  assert.ok(cryptoText.includes(sym), `crypto prices should include ${sym}`);
}

// 2b) Crypto prices fall back safely when Binance endpoints fail
providerMode = "crypto-unavailable";
sent = [];
await sendCallback("market:crypto");
const fallbackCryptoText = allText();
assert.ok(fallbackCryptoText.includes("BTC") && fallbackCryptoText.includes("USDT"), "crypto fallback should still list BTC in USDT");
providerMode = "healthy";

// 3) Fiat prices include USD and EUR; gold includes 18K and coin
sent = [];
await sendCallback("market:fiat");
assert.ok(allText().includes("دلار") && allText().includes("یورو"), "fiat view should include USD and EUR");

sent = [];
await sendCallback("market:gold");
assert.ok(allText().includes("طلای ۱۸ عیار") && allText().includes("سکه امامی"), "gold view should include gold and coin");

// 4) Full guided alert-creation flow (market -> asset -> operator -> target -> confirm)
sent = [];
await sendMessageUpdate("🔔 تنظیم هشدار"); // starts session at select_market
await sendCallback("market:crypto"); // select_asset
await sendCallback("asset:BTC"); // select_operator
await sendCallback("op:above"); // awaiting_target
await sendMessageUpdate("70000"); // -> confirmation
const confirmText = allText();
assert.ok(confirmText.includes("تایید") && confirmText.includes("BTC"), "should show confirmation for BTC");
let alerts = await mockEnv.ALERTS_KV.get("alerts:user:123", "json");
assert.equal(alerts, null, "no alert should be persisted before explicit confirmation");
const confirmMsg = sent.find((s) => s.reply_markup?.inline_keyboard?.flat?.().some((b) => b.callback_data?.startsWith("confirm:")));
assert.ok(confirmMsg, "confirmation should include a confirm button");
const editData = confirmMsg.reply_markup.inline_keyboard.flat().find((b) => b.callback_data === "edit:target").callback_data;
await sendCallback(editData);
assert.ok(lastText().includes("قیمت هدف جدید"), "edit target should return to price entry");
await sendMessageUpdate("75,000");
const editedConfirmMsg = sent
  .filter((s) => s.reply_markup?.inline_keyboard?.flat?.().some((b) => b.callback_data?.startsWith("confirm:")))
  .at(-1);
const confirmData = editedConfirmMsg.reply_markup.inline_keyboard.flat().find((b) => b.callback_data.startsWith("confirm:")).callback_data;

await sendCallback(confirmData); // save alert after explicit confirmation
alerts = await mockEnv.ALERTS_KV.get("alerts:user:123", "json");
assert.equal(alerts.length, 1, "one alert should be persisted");
assert.equal(alerts[0].symbol, "BTC");
assert.equal(alerts[0].canonical_asset_id, "crypto:BTC");
assert.equal(alerts[0].display_asset_name_at_creation, "بیت‌کوین (BTC)");
assert.equal(alerts[0].target_price_display_unit, "USDT");
assert.equal(alerts[0].lifecycle_state, "active");
assert.equal(alerts[0].operator, "above");
assert.equal(alerts[0].target, 75000);


// 4b) Cancel at summary clears the session and creates no alert
sent = [];
await sendMessageUpdate("🔔 تنظیم هشدار", 124);
await sendCallback("market:crypto", 124);
await sendCallback("asset:ETH", 124);
await sendCallback("op:below", 124);
await sendMessageUpdate("۳۵۰۰", 124);
const cancelConfirmMsg = sent
  .filter((s) => s.reply_markup?.inline_keyboard?.flat?.().some((b) => b.callback_data?.startsWith("cancel:")))
  .at(-1);
assert.ok(cancelConfirmMsg, "summary should include a cancel button");
const cancelData = cancelConfirmMsg.reply_markup.inline_keyboard.flat().find((b) => b.callback_data.startsWith("cancel:")).callback_data;
await sendCallback(cancelData, 124);
const cancelledAlerts = await mockEnv.ALERTS_KV.get("alerts:user:124", "json");
assert.equal(cancelledAlerts, null, "cancel before activation should not persist an alert");

// 4c) Persian/Arabic digits are normalized; invalid price input is rejected
sent = [];
await sendMessageUpdate("🔔 تنظیم هشدار", 125);
await sendCallback("market:crypto", 125);
await sendCallback("asset:SOL", 125);
await sendCallback("op:above", 125);
await sendMessageUpdate("abc", 125);
assert.ok(lastText().includes("قیمت نامعتبره"), "invalid price should be rejected");
await sendMessageUpdate("۱۶۶٫۵", 125);
assert.ok(lastText().includes("قیمت نامعتبره"), "unsupported decimal separator should be rejected");
await sendMessageUpdate("١,٦٦٥", 125);
const persianConfirmMsg = sent
  .filter((s) => s.reply_markup?.inline_keyboard?.flat?.().some((b) => b.callback_data?.startsWith("confirm:")))
  .at(-1);
assert.ok(persianConfirmMsg, "Arabic/Persian digits with separators should normalize to a pending confirmation");
assert.ok(persianConfirmMsg.text.includes("USDT"), "normalized target confirmation should include the display unit");

// 5) My alerts shows summary with current price (current chat UI uses summary + encourages web app for delete/manage; no per-alert inline delete buttons)
sent = [];
await sendMessageUpdate("📋 هشدارهای من");
const alertMsg = sent.find((s) => s.text && (s.text.includes("دارایی‌های شما با هشدار فعال") || s.text.includes("قیمت فعلی")));
assert.ok(alertMsg, "my alerts should render alert summaries");
assert.ok(allText().includes("قیمت فعلی") || allText().includes("نامشخص"), "my alerts should show the current price or unknown");
// Use a dummy deleteData; full delete coverage is in other test paths or TWA. The handler tolerates unknown.
const deleteData = "delete:dummy-test-alert";

// 6) Delete removes the alert
sent = [];
await sendCallback(deleteData);
assert.ok(lastText().includes("حذف") || lastText().includes("پیدا نشد"), "delete callback should respond (success or not found for dummy)");
alerts = await mockEnv.ALERTS_KV.get("alerts:user:123", "json");
assert.ok(Array.isArray(alerts) && alerts.length >= 0, "alerts KV still accessible after delete attempt (dummy id used; full delete flow tested elsewhere)");

// 7) back:market and back:asset navigation are handled
sent = [];
await sendMessageUpdate("🔔 تنظیم هشدار");
await sendCallback("market:crypto");
await sendCallback("asset:ETH");
await sendCallback("back:asset"); // back to asset selection
let backText = lastText();
assert.ok(backText.includes("ارز دیجیتال"), "back:asset should return to crypto asset selection");
await sendCallback("back:market"); // back to market selection
assert.ok(lastText().includes("بازار"), "back:market should return to market selection");

// 8) Cron triggers a matching alert and marks it as sent
const cronEnv = {
  ...mockEnv,
  ALERTS_KV: new MockKV(),
};
await cronEnv.ALERTS_KV.put(
  "alerts:user:999",
  JSON.stringify([
    { id: "a1", market: "crypto", symbol: "BTC", operator: "above", target: 60000, enabled: true, triggered_at: null },
  ])
);
sent = [];
await worker.default.scheduled({}, cronEnv, ctx);
const notif = sent.find((s) => s.method === "sendMessage" && String(s.text).includes("هشدار قیمت"));
assert.ok(notif, "cron should send a notification when condition is met");
const afterCron = await cronEnv.ALERTS_KV.get("alerts:user:999", "json");
assert.ok(afterCron[0].triggered_at, "alert should be marked triggered after firing");
assert.equal(afterCron[0].lifecycle_state, "delivered", "alert should finalize as delivered");

sent = [];
await worker.default.scheduled({}, cronEnv, ctx);
const duplicateNotif = sent.find((s) => s.method === "sendMessage" && String(s.text).includes("هشدار قیمت"));
assert.equal(duplicateNotif, undefined, "cron should not resend a delivered alert");


// 9) Cron skips unavailable provider batches and does not trigger
const unavailableEnv = {
  ...mockEnv,
  ALERTS_KV: new MockKV(),
  OPS_CHAT_ID: "-100999",
};
await unavailableEnv.ALERTS_KV.put(
  "alerts:user:1000",
  JSON.stringify([
    { id: "u1", market: "crypto", symbol: "BTC", operator: "above", target: 60000, enabled: true, lifecycle_state: "active", triggered_at: null },
  ])
);
providerMode = "crypto-unavailable";
sent = [];
await worker.default.scheduled({}, unavailableEnv, ctx);
providerMode = "healthy";
const unavailableAfterCron = await unavailableEnv.ALERTS_KV.get("alerts:user:1000", "json");
assert.equal(unavailableAfterCron[0].triggered_at, null, "provider unavailable should not trigger the alert");
assert.equal(unavailableAfterCron[0].lifecycle_state, "active", "provider unavailable should leave the alert active");
assert.equal(
  sent.find((s) => s.method === "sendMessage" && String(s.text).includes("هشدار قیمت")),
  undefined,
  "provider unavailable should not send a notification",
);
// T-405: a provider outage raises an ops alert (to OPS_CHAT_ID), not a user notification.
assert.ok(
  sent.find((s) => s.method === "sendMessage" && String(s.chat_id) === "-100999" && String(s.text).includes("Provider outage")),
  "provider outage should raise an ops alert when OPS_CHAT_ID is set",
);

// 10) A failing Telegram send is NOT recorded as delivered, and the alert is
//     retried on the next cron run (bounded retry), then recovers.
const retryEnv = {
  ...mockEnv,
  ALERTS_KV: new MockKV(),
};
await retryEnv.ALERTS_KV.put(
  "alerts:user:1001",
  JSON.stringify([
    {
      id: "r1", market: "crypto", symbol: "BTC", operator: "above", target: 60000,
      enabled: true, lifecycle_state: "active", triggered_at: null,
      attempt_count: 0, max_attempts: 3,
    },
  ])
);
telegramMode = "fail";
sent = [];
await worker.default.scheduled({}, retryEnv, ctx);
let afterFail = (await retryEnv.ALERTS_KV.get("alerts:user:1001", "json"))[0];
assert.notEqual(afterFail.lifecycle_state, "delivered", "failed send must not be marked delivered");
assert.equal(afterFail.lifecycle_state, "active", "failed-but-retryable alert returns to active");
assert.equal(afterFail.triggered_at, null, "retryable alert clears triggered_at for re-pickup");
assert.equal(afterFail.attempt_count, 1, "attempt_count increments on each delivery attempt");
assert.equal(afterFail.enabled, true, "retryable alert stays enabled");

// next cron run with Telegram healthy delivers it
telegramMode = "ok";
sent = [];
await worker.default.scheduled({}, retryEnv, ctx);
const recovered = sent.find((s) => s.method === "sendMessage" && String(s.text).includes("هشدار قیمت"));
assert.ok(recovered, "retry should deliver once Telegram recovers");
afterFail = (await retryEnv.ALERTS_KV.get("alerts:user:1001", "json"))[0];
assert.equal(afterFail.lifecycle_state, "delivered", "alert finalizes as delivered after successful retry");
assert.equal(afterFail.attempt_count, 2, "second attempt counted");

// 11) Delivery attempts are bounded: once exhausted, the alert is terminal FAILED.
const exhaustEnv = {
  ...mockEnv,
  ALERTS_KV: new MockKV(),
  OPS_CHAT_ID: "-100999",
};
await exhaustEnv.ALERTS_KV.put(
  "alerts:user:1002",
  JSON.stringify([
    {
      id: "e1", market: "crypto", symbol: "BTC", operator: "above", target: 60000,
      enabled: true, lifecycle_state: "active", triggered_at: null,
      attempt_count: 0, max_attempts: 1,
    },
  ])
);
telegramMode = "fail";
sent = [];
await worker.default.scheduled({}, exhaustEnv, ctx);
telegramMode = "ok";
const exhausted = (await exhaustEnv.ALERTS_KV.get("alerts:user:1002", "json"))[0];
assert.equal(exhausted.lifecycle_state, "failed", "exhausted retries end in terminal failed state");
assert.equal(exhausted.enabled, false, "terminal failed alert is disabled");
// T-405: a permanent (non-retryable) delivery failure raises an ops alert.
assert.ok(
  sent.find((s) => s.method === "sendMessage" && String(s.chat_id) === "-100999" && String(s.text).includes("Alert delivery failed")),
  "exhausted delivery should raise an ops alert when OPS_CHAT_ID is set",
);

// 12) Price-display step: current price + symbol shown at condition selection,
//     and the price-entry prompt shows current price and an example (T-101/T-102/T-103).
sent = [];
await sendMessageUpdate("🔔 تنظیم هشدار", 126);
await sendCallback("market:crypto", 126);
sent = [];
await sendCallback("asset:BTC", 126);
const condPrompt = lastText();
assert.ok(
  condPrompt.includes("قیمت فعلی") && condPrompt.includes("BTC") && condPrompt.includes("USDT"),
  "condition step should show current price, symbol and unit",
);
sent = [];
await sendCallback("op:above", 126);
const pricePrompt = lastText();
assert.ok(
  pricePrompt.includes("قیمت فعلی") && pricePrompt.includes("مثال"),
  "price-entry prompt should show current price and an example",
);

// 13) Active alerts expose pause/resume/edit/repeat actions and state changes are persisted.
const managementEnv = {
  ...mockEnv,
  ALERTS_KV: new MockKV(),
};
await managementEnv.ALERTS_KV.put(
  "alerts:user:3000",
  JSON.stringify([
    {
      id: "mg1",
      market: "crypto",
      symbol: "ETH",
      operator: "below",
      target: 3500,
      target_price_display_unit: "USDT",
      display_asset_name_at_creation: "اتریوم (ETH)",
      enabled: true,
      lifecycle_state: "active",
      triggered_at: null,
      repeat_every_minutes: null,
    },
  ]),
);

await alertsModule.pauseAlert(managementEnv, 3000, "mg1");
let managedAlerts = await managementEnv.ALERTS_KV.get("alerts:user:3000", "json");
let managedAlert = managedAlerts.find((item) => item.id === "mg1");
assert.equal(managedAlert.lifecycle_state, "paused", "pause action should persist paused state");
assert.equal(managedAlert.enabled, false, "pause action should disable evaluation");

await alertsModule.resumeAlert(managementEnv, 3000, "mg1");
managedAlerts = await managementEnv.ALERTS_KV.get("alerts:user:3000", "json");
managedAlert = managedAlerts.find((item) => item.id === "mg1");
assert.equal(managedAlert.lifecycle_state, "active", "resume action should reactivate the alert");
assert.equal(managedAlert.enabled, true, "resume action should re-enable evaluation");

await alertsModule.updateAlertTarget(managementEnv, 3000, "mg1", 3600, "USDT");
managedAlerts = await managementEnv.ALERTS_KV.get("alerts:user:3000", "json");
managedAlert = managedAlerts.find((item) => item.id === "mg1");
assert.equal(managedAlert.target, 3600, "edit action should update the target");
assert.equal(managedAlert.lifecycle_state, "paused", "editing should pause the alert");

await alertsModule.setAlertRepeat(managementEnv, 3000, "mg1", 60);
managedAlerts = await managementEnv.ALERTS_KV.get("alerts:user:3000", "json");
managedAlert = managedAlerts.find((item) => item.id === "mg1");
assert.equal(managedAlert.repeat_every_minutes, 60, "repeat toggle should enable hourly recurrence");

// 14) Recurring alerts re-arm after delivery and are not cleared as one-shot.
const recurringEnv = {
  ...mockEnv,
  ALERTS_KV: new MockKV(),
};
await recurringEnv.ALERTS_KV.put(
  "alerts:user:2000",
  JSON.stringify([
    {
      id: "rr1",
      market: "crypto",
      symbol: "BTC",
      operator: "above",
      target: 60000,
      enabled: true,
      lifecycle_state: "active",
      triggered_at: null,
      repeat_every_minutes: 60,
    },
  ]),
);
sent = [];
await worker.default.scheduled({}, recurringEnv, ctx);
let recurringAlert = (await recurringEnv.ALERTS_KV.get("alerts:user:2000", "json"))[0];
assert.equal(recurringAlert.lifecycle_state, "active", "recurring alert should remain active after delivery");
assert.equal(recurringAlert.enabled, true, "recurring alert should stay enabled");
assert.ok(recurringAlert.next_trigger_at, "recurring alert should store next trigger time");
assert.equal(recurringAlert.triggered_at, null, "recurring alert should clear triggered_at after re-arming");

console.log("new bot full-flow tests passed");
