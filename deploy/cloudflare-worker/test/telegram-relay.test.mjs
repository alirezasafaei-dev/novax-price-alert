import assert from "node:assert/strict";
import worker from "../telegram-relay.js";

const originalFetch = globalThis.fetch;

async function readJson(response) {
  return response.json();
}

function createKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async list({ prefix = "" } = {}) {
      return { keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
}

try {
  const telegramRequests = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("tgju.org/profile") || String(url) === "https://www.tgju.org/") {
      const html = String(url).includes("/") && !String(url).includes("profile")
        ? `<div id="l-crypto-tether-irr"><span class="info-price">1,709,920</span></div>`
        : `<span class="price" data-col="info.last_trade.PDrCotVal">1,704,850</span>`;
      return new Response(html, { status: 200 });
    }
    telegramRequests.push({ url, init });
    return Response.json({ ok: true, result: { message_id: 99 } });
  };

  const env = { RELAY_SECRET: "expected", TELEGRAM_BOT_TOKEN: "token", ALERTS_KV: createKv() };

  const health = await worker.fetch(new Request("https://relay.example/health"), {});
  assert.equal(health.status, 200);
  assert.deepEqual(await readJson(health), { status: "ok", service: "telegram-relay" });

  const debug = await worker.fetch(
    new Request("https://relay.example/debug", { headers: { "X-Relay-Secret": "expected" } }),
    env,
  );
  assert.equal(debug.status, 200);
  const debugPayload = await readJson(debug);
  assert.equal(debugPayload.display_unit, "Toman");
  assert.equal(debugPayload.timezone, "Asia/Tehran");
  assert.deepEqual(debugPayload.commands, ["/start", "/help", "/prices", "/alert", "/alerts", "/delete"]);

  const unauthorized = await worker.fetch(
    new Request("https://relay.example/send", { method: "POST" }),
    env,
  );
  assert.equal(unauthorized.status, 401);

  const sent = await worker.fetch(
    new Request("https://relay.example/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-Secret": "expected" },
      body: JSON.stringify({ chat_id: "42", text: "hello" }),
    }),
    env,
  );

  assert.equal(sent.status, 200);
  assert.equal(telegramRequests.at(-1).url, "https://api.telegram.org/bottoken/sendMessage");
  assert.deepEqual(JSON.parse(telegramRequests.at(-1).init.body), {
    chat_id: "42",
    text: "hello",
    disable_web_page_preview: true,
  });

  const webhook = await worker.fetch(
    new Request("https://relay.example/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { chat: { id: 123 }, text: "/start" } }),
    }),
    env,
  );
  assert.equal(webhook.status, 200);
  const webhookPayload = JSON.parse(telegramRequests.at(-1).init.body);
  assert.equal(webhookPayload.chat_id, 123);
  assert.match(webhookPayload.text, /نواکس فعاله/);

  const pricesWebhook = await worker.fetch(
    new Request("https://relay.example/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { chat: { id: 123 }, text: "/prices" } }),
    }),
    env,
  );
  assert.equal(pricesWebhook.status, 200);
  const pricesPayload = JSON.parse(telegramRequests.at(-1).init.body);
  assert.match(pricesPayload.text, /قیمت‌های لحظه‌ای/);
  assert.match(pricesPayload.text, /دلار آزاد/);
  assert.match(pricesPayload.text, /تومان/);
  assert.match(pricesPayload.text, /وقت تهران/);
  assert.doesNotMatch(pricesPayload.text, /UTC/);


  const createAlert = await worker.fetch(
    new Request("https://relay.example/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { chat: { id: 123 }, text: "/alert USD 170000 above" } }),
    }),
    env,
  );
  assert.equal(createAlert.status, 200);
  const createAlertPayload = JSON.parse(telegramRequests.at(-1).init.body);
  assert.match(createAlertPayload.text, /هشدار ساخته شد/);
  const alertId = createAlertPayload.text.match(/ID: (?<id>[a-f0-9]+)/).groups.id;

  const listAlerts = await worker.fetch(
    new Request("https://relay.example/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { chat: { id: 123 }, text: "/alerts" } }),
    }),
    env,
  );
  assert.equal(listAlerts.status, 200);
  const listAlertsPayload = JSON.parse(telegramRequests.at(-1).init.body);
  assert.match(listAlertsPayload.text, new RegExp(alertId));
  assert.match(listAlertsPayload.text, /دلار آزاد/);

  const deleteAlert = await worker.fetch(
    new Request("https://relay.example/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { chat: { id: 123 }, text: `/delete ${alertId}` } }),
    }),
    env,
  );
  assert.equal(deleteAlert.status, 200);
  const deleteAlertPayload = JSON.parse(telegramRequests.at(-1).init.body);
  assert.match(deleteAlertPayload.text, /حذف شد/);

  const setWebhook = await worker.fetch(
    new Request("https://relay.example/set-webhook", {
      method: "POST",
      headers: { "X-Relay-Secret": "expected" },
    }),
    env,
  );
  assert.equal(setWebhook.status, 200);
  assert.equal(telegramRequests.at(-1).url, "https://api.telegram.org/bottoken/setWebhook");
  assert.equal(JSON.parse(telegramRequests.at(-1).init.body).url, "https://relay.example/webhook");

  console.log("telegram relay worker tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
