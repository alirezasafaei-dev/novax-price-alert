import assert from "node:assert";
import { logEvent, logWarn, logError } from "../src/log.js";

// هر رویداد باید یک خط JSON معتبر با کلیدهای ثابت event/level/ts باشد (T-401).
function captureLine(channel, fn) {
  const original = console[channel];
  let captured = null;
  console[channel] = (line) => {
    captured = line;
  };
  try {
    fn();
  } finally {
    console[channel] = original;
  }
  return captured;
}

// 1) logEvent → سطح info روی console.log و JSON معتبر با فیلدهای اختصاصی.
let line = captureLine("log", () =>
  logEvent("alert_evaluated", { alert_id: "a1", worker_run_id: "r1" }),
);
let parsed = JSON.parse(line);
assert.equal(parsed.event, "alert_evaluated");
assert.equal(parsed.level, "info");
assert.equal(parsed.alert_id, "a1");
assert.equal(parsed.worker_run_id, "r1");
assert.ok(!Number.isNaN(Date.parse(parsed.ts)), "ts must be an ISO timestamp");

// 2) logWarn → سطح warn روی console.warn.
line = captureLine("warn", () => logWarn("stale_data_detected", { reason: "x" }));
parsed = JSON.parse(line);
assert.equal(parsed.event, "stale_data_detected");
assert.equal(parsed.level, "warn");
assert.equal(parsed.reason, "x");

// 3) logError → سطح error روی console.error.
line = captureLine("error", () => logError("notification_send_failed", { error_message: "boom" }));
parsed = JSON.parse(line);
assert.equal(parsed.event, "notification_send_failed");
assert.equal(parsed.level, "error");
assert.equal(parsed.error_message, "boom");

console.log("structured log schema tests passed");
