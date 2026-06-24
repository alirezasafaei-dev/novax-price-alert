import assert from "node:assert";
import crypto from "node:crypto";
import worker from "../src/index.js";

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

function signedInitData(botToken, payload) {
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const params = new URLSearchParams({ ...payload, hash });
  return params.toString();
}

const env = {
  TELEGRAM_BOT_TOKEN: "123:test",
  TELEGRAM_SECRET_TOKEN: "test_secret",
  ALERTS_KV: new MockKV(),
  SESSIONS_KV: new MockKV(),
  USERS_KV: new MockKV(),
};

global.fetch = async (url) => {
  const hostname = new URL(String(url)).hostname;
  if (
    hostname === "api.binance.com" ||
    hostname === "data-api.binance.vision" ||
    hostname.endsWith(".binance.com") ||
    hostname.endsWith(".binance.vision")
  ) {
    return Response.json([
      { symbol: "BTCUSDT", price: "67240.00" },
      { symbol: "ETHUSDT", price: "3420.00" },
      { symbol: "SOLUSDT", price: "165.00" },
      { symbol: "BNBUSDT", price: "590.00" },
    ]);
  }
  if (hostname.endsWith(".tgju.org")) {
    return Response.json({
      current: {
        price_dollar_rl: { p: "1,700,000" },
        price_eur: { p: "1,850,000" },
        geram18: { p: "35,000,000" },
        sekee: { p: "400,000,000" },
      },
    });
  }
  return Response.json({ ok: true });
};

const ctx = { waitUntil() {} };
const initData = signedInitData("123:test", {
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: 42, username: "asdev", first_name: "Ali" }),
});

let response = await worker.fetch(new Request("https://worker.example/api/v1/prices/latest"), env, ctx);
assert.equal(response.status, 200);
let payload = await response.json();
assert.ok(payload.items.find((item) => item.asset_code === "BTC_USDT"));
assert.ok(payload.items.find((item) => item.asset_code === "USD_IRT"));

response = await worker.fetch(new Request("https://worker.example/api/v1/alerts"), env, ctx);
assert.equal(response.status, 401);

response = await worker.fetch(
  new Request("https://worker.example/api/v1/alerts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify({
      asset_code: "BTC_USDT",
      condition_type: "above",
      target_price: 70000,
      cooldown_minutes: 60,
    }),
  }),
  env,
  ctx,
);
assert.equal(response.status, 201);
payload = await response.json();
assert.equal(payload.asset_code, "BTC_USDT");
assert.equal(payload.symbol, "BTC");
assert.equal(payload.lifecycle_state, "active");
const alertId = payload.id;

response = await worker.fetch(
  new Request("https://worker.example/api/v1/alerts", {
    headers: { "X-Telegram-Init-Data": initData },
  }),
  env,
  ctx,
);
payload = await response.json();
assert.equal(payload.items.length, 1);

response = await worker.fetch(
  new Request(`https://worker.example/api/v1/alerts/${alertId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify({ target_price: 75000 }),
  }),
  env,
  ctx,
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.target_price, 75000);
assert.equal(payload.lifecycle_state, "paused");

response = await worker.fetch(
  new Request(`https://worker.example/api/v1/alerts/${alertId}`, {
    method: "DELETE",
    headers: { "X-Telegram-Init-Data": initData },
  }),
  env,
  ctx,
);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { success: true });
