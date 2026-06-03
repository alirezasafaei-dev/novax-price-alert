import assert from "node:assert";
import { recordMetric } from "../src/metrics.js";
import { sendOpsAlert, maybeOpsAlert, shouldAlert } from "../src/alerting.js";

class MockKV extends Map {
  async get(key) {
    return super.get(key) ?? null;
  }
  async put(key, val) {
    super.set(key, val);
  }
}

// ---- T-403: metrics ----

// 1) با binding موجود، writeDataPoint با طرح مورد انتظار صدا زده می‌شود.
let points = [];
const envWithMetrics = { METRICS: { writeDataPoint: (p) => points.push(p) } };
let ok = recordMetric(envWithMetrics, "alert_created", { market: "crypto", asset: "crypto:BTC" });
assert.equal(ok, true);
assert.equal(points.length, 1);
assert.deepEqual(points[0].indexes, ["alert_created"]);
assert.deepEqual(points[0].blobs, ["alert_created", "crypto", "crypto:BTC"]);
assert.deepEqual(points[0].doubles, [1]);

// 2) بدون binding، no-op است و throw نمی‌کند.
assert.equal(recordMetric({}, "x"), false);
assert.equal(recordMetric(undefined, "x"), false);

// 3) خطای binding مسیر اصلی را نمی‌شکند.
const envThrows = { METRICS: { writeDataPoint: () => { throw new Error("boom"); } } };
assert.equal(recordMetric(envThrows, "x"), false);

// ---- T-405: operational alerting ----

// 4) بدون OPS_CHAT_ID هیچ پیامی ارسال نمی‌شود (no-op).
let calls = [];
global.fetch = async (url, options) => {
  calls.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null });
  return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
};
assert.equal(await sendOpsAlert({ TELEGRAM_BOT_TOKEN: "t" }, "x"), false);
assert.equal(calls.length, 0);

// 5) با OPS_CHAT_ID پیام به همان chat ارسال می‌شود و عنوان/فیلدها در متن می‌آیند.
calls = [];
const opsEnv = { TELEGRAM_BOT_TOKEN: "t", OPS_CHAT_ID: "-100123" };
assert.equal(await sendOpsAlert(opsEnv, "Provider outage", { provider: "crypto" }), true);
assert.equal(calls.length, 1);
assert.equal(calls[0].body.chat_id, "-100123");
assert.ok(calls[0].body.text.includes("Provider outage") && calls[0].body.text.includes("crypto"));

// 6) cooldown: maybeOpsAlert فقط یک‌بار در بازه ارسال می‌کند.
calls = [];
const cdEnv = { TELEGRAM_BOT_TOKEN: "t", OPS_CHAT_ID: "-100123", ALERTS_KV: new MockKV() };
assert.equal(await maybeOpsAlert(cdEnv, "provider_outage:crypto", "Provider outage", {}), true);
assert.equal(await maybeOpsAlert(cdEnv, "provider_outage:crypto", "Provider outage", {}), false);
assert.equal(calls.length, 1, "second alert within cooldown must be suppressed");

// 7) shouldAlert بدون KV همیشه true (محیط تخریب‌نشده).
assert.equal(await shouldAlert({}, "k"), true);

console.log("metrics + ops-alerting tests passed");
