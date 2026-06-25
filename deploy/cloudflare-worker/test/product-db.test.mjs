import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";

import {
  claimAlertDb,
  createPaymentRequest,
  getEntitlement,
  insertAlert,
  listDueAlertsDb,
  listUserAlertsDb,
  reviewPayment,
  upsertUser,
} from "../src/product-db.js";

const mf = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('ok') } }",
  d1Databases: ["DB"],
});

try {
  const DB = await mf.getD1Database("DB");
  const migration = await readFile(
    new URL("../migrations/0001_product_core.sql", import.meta.url),
    "utf8",
  );
  for (const statement of migration
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)) {
    await DB.prepare(statement).run();
  }
  const env = { DB };
  await upsertUser(env, {
    telegram_user_id: "42",
    username: "tester",
    first_name: "Test",
  });

  const baseAlert = {
    canonical_asset_id: "fiat:USDT",
    market: "fiat",
    symbol: "USDT",
    display_asset_name_at_creation: "تتر (USDT)",
    operator: "above",
    target: 170000,
    target_price_display_unit: "تومان",
  };

  for (let index = 0; index < 3; index += 1) {
    await insertAlert(env, "42", { ...baseAlert, target: 170000 + index }, `a${index}`);
  }
  assert.equal((await listUserAlertsDb(env, "42")).length, 3);
  await assert.rejects(
    insertAlert(env, "42", baseAlert, "a4"),
    /سقف ۳ هشدار/,
  );

  const payment = await createPaymentRequest(env, "42", "tracking-123");
  const approved = await reviewPayment(env, payment.id, "admin-1", true);
  assert.equal(approved.status, "approved");
  assert.equal((await getEntitlement(env, "42")).plan, "pro");

  await insertAlert(env, "42", baseAlert, "a4");
  assert.equal((await listUserAlertsDb(env, "42")).length, 4);

  await DB.prepare(
    "UPDATE alerts SET next_check_at = ? WHERE telegram_user_id = ?",
  ).bind(new Date(Date.now() - 1000).toISOString(), "42").run();
  const due = await listDueAlertsDb(env);
  assert.equal(due.length, 4);
  assert.ok(due.every((alert) => alert.check_interval_seconds === 60));

  const claimed = await claimAlertDb(env, due[0], "event:a0", 180000);
  assert.equal(claimed.lifecycle_state, "delivery_in_progress");
  const duplicateClaim = await claimAlertDb(env, due[0], "event:a0:duplicate", 180000);
  assert.equal(duplicateClaim, null);

  await DB.prepare(`
    UPDATE alerts SET lease_expires_at = ?, lifecycle_state = 'delivery_in_progress'
    WHERE id = ?
  `).bind(new Date(Date.now() - 1000).toISOString(), due[0].id).run();
  const recovered = await listDueAlertsDb(env);
  assert.ok(recovered.some((alert) => alert.id === due[0].id));

  console.log("product D1 repository tests passed");
} finally {
  await mf.dispose();
}
