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

global.fetch = async (url, options) => {
  const u = String(url);

  if (u.includes("api.telegram.org")) {
    const method = u.split("/").pop();
    const body = options?.body ? JSON.parse(options.body) : {};
    sent.push({ method, ...body });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: sent.length } }) };
  }

  if (u.includes("binance")) {
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

  if (u.includes("tgju.org")) {
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
let alerts = await mockEnv.ALERTS_KV.get("alerts:user:123", "json");
assert.equal(alerts.length, 1, "one alert should be persisted");
assert.equal(alerts[0].symbol, "BTC");
assert.equal(alerts[0].canonical_asset_id, "crypto:BTC");
assert.equal(alerts[0].display_asset_name_at_creation, "بیت‌کوین (BTC)");
assert.equal(alerts[0].target_price_display_unit, "USDT");
assert.equal(alerts[0].lifecycle_state, "active");
assert.equal(alerts[0].operator, "above");
assert.equal(alerts[0].target, 75000);

// 5) My alerts shows the alert with a delete button and current price
sent = [];
await sendMessageUpdate("📋 هشدارهای من");
const alertMsg = sent.find((s) => s.reply_markup?.inline_keyboard?.flat?.().some((b) => b.callback_data?.startsWith("delete:")));
assert.ok(alertMsg, "my alerts should render a delete button per alert");
assert.ok(allText().includes("قیمت فعلی"), "my alerts should show the current price");
const deleteData = alertMsg.reply_markup.inline_keyboard.flat().find((b) => b.callback_data.startsWith("delete:")).callback_data;

// 6) Delete removes the alert
sent = [];
await sendCallback(deleteData);
assert.ok(lastText().includes("حذف"), "delete should confirm removal");
alerts = await mockEnv.ALERTS_KV.get("alerts:user:123", "json");
assert.equal(alerts.length, 0, "alert should be removed after delete");

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

console.log("new bot full-flow tests passed");
