import assert from "node:assert";
import { recordCronHeartbeat, getCronStatus, EXPECTED_INTERVAL_SECONDS } from "../src/heartbeat.js";
import { getTickPlan } from "../src/cron.js";

class MockKV extends Map {
  async get(key, type) {
    const v = super.get(key) ?? null;
    return type === "json" && v != null ? JSON.parse(v) : v;
  }
  async put(key, val) {
    super.set(key, val);
  }
}

// 1) بدون KV: ثبت no-op است و وضعیت «unknown / stale» برمی‌گردد.
assert.equal(await recordCronHeartbeat({}, { checked: 1 }), false);
const unknown = await getCronStatus({});
assert.equal(unknown.status, "unknown");
assert.equal(unknown.stale, true);
assert.equal(unknown.last_cron_run, null);

// 2) پس از ثبت ضربان، وضعیت تازه = ok و شمارش‌ها حفظ می‌شوند.
const kv = new MockKV();
const env = { ALERTS_KV: kv };
assert.equal(await recordCronHeartbeat(env, { checked: 5, triggered: 1 }), true);
const fresh = await getCronStatus(env);
assert.equal(fresh.status, "ok");
assert.equal(fresh.stale, false);
assert.equal(fresh.checked, 5);
assert.equal(fresh.triggered, 1);
assert.equal(fresh.expected_interval_seconds, EXPECTED_INTERVAL_SECONDS);
assert.ok(fresh.age_seconds >= 0 && fresh.age_seconds < 60);

// 3) اگر آخرین اجرا قدیمی باشد (بیش از آستانه)، stale می‌شود.
const oldTs = new Date(Date.now() - 3600 * 1000).toISOString();
kv.set("cron:last_run", JSON.stringify({ ts: oldTs, checked: 0, triggered: 0 }));
const stale = await getCronStatus(env, { staleAfterSeconds: 1800 });
assert.equal(stale.status, "stale");
assert.equal(stale.stale, true);
assert.ok(stale.age_seconds > 1800);

// 4) همان داده‌ی قدیمی با آستانه‌ی بزرگ‌تر، ok محسوب می‌شود (مرز آستانه).
const okWide = await getCronStatus(env, { staleAfterSeconds: 7200 });
assert.equal(okWide.status, "ok");
assert.equal(okWide.stale, false);

console.log("cron heartbeat tests passed");

// One-minute alert ticks must not multiply hourly jobs, snapshots or KV writes.
const ticks = Array.from({ length: 60 }, (_, minute) => getTickPlan(Date.UTC(2026, 10, 28, 12, minute)));
assert.equal(ticks.filter(t => t.hourly).length, 1);
assert.equal(ticks.filter(t => t.snapshot).length, 6);
assert.equal(ticks.filter(t => t.heartbeat).length, 12);
assert.equal(EXPECTED_INTERVAL_SECONDS, 300);
await recordCronHeartbeat(env, { checked: 0, success: false });
const failed = await getCronStatus(env);
assert.equal(failed.status, "error");
assert.equal(failed.stale, true);
await recordCronHeartbeat(env, { checked: 1 });
assert.equal((await getCronStatus(env)).status, "ok");
