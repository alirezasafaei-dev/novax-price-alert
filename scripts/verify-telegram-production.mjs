#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { setDefaultResultOrder } from "node:dns";
import { setTimeout as sleep } from "node:timers/promises";

setDefaultResultOrder("ipv4first");

function loadEnvFile(path) {
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...valueParts] = line.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

function pickCronFields(cron) {
  if (!cron) return null;
  return {
    started_at: cron.started_at,
    finished_at: cron.finished_at,
    storage: cron.storage,
    checked_count: cron.checked_count,
    triggered_count: cron.triggered_count,
    failed_count: cron.failed_count,
  };
}

async function request(baseUrl, path, { method = "GET", auth = true } = {}) {
  const headers = { "User-Agent": "novax-production-verifier/1.0" };
  if (auth) headers["X-Relay-Secret"] = process.env.TELEGRAM_RELAY_SECRET;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { method, headers });
      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { body: text.slice(0, 160) };
      }
      if (!response.ok) {
        throw new Error(`${method} ${path} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 1000);
    }
  }
  throw lastError;
}

function summarize(path, payload) {
  if (path === "/webhook-info") {
    const result = payload.telegram?.result || {};
    return {
      ok: payload.ok,
      url: result.url,
      pending_update_count: result.pending_update_count,
      last_error_message: result.last_error_message,
    };
  }
  if (path === "/debug") {
    return {
      status: payload.status,
      service: payload.service,
      storage: payload.storage,
      cron: pickCronFields(payload.cron),
    };
  }
  if (path === "/cron-status") {
    return {
      ok: payload.ok,
      storage: payload.storage,
      cron_present: payload.cron_present,
      cron: pickCronFields(payload.cron),
    };
  }
  if (path === "/run-cron") {
    return pickCronFields(payload);
  }
  return payload;
}

loadEnvFile(".env");

if (!process.env.TELEGRAM_RELAY_URL) {
  throw new Error("TELEGRAM_RELAY_URL is required");
}
if (!process.env.TELEGRAM_RELAY_SECRET) {
  throw new Error("TELEGRAM_RELAY_SECRET is required");
}

const baseUrl = process.env.TELEGRAM_RELAY_URL.replace(/\/$/, "");
const runManualCron = process.argv.includes("--run-cron");
const checks = [
  { path: "/health", auth: false },
  { path: "/debug" },
  { path: "/storage-check" },
  { path: "/webhook-info" },
  { path: "/cron-status" },
];
if (runManualCron) {
  checks.push({ path: "/run-cron", method: "POST" });
  checks.push({ path: "/cron-status" });
}

for (const check of checks) {
  const payload = await request(baseUrl, check.path, check);
  console.log(`${check.method || "GET"} ${check.path} ${JSON.stringify(summarize(check.path, payload))}`);
}
