import assert from "node:assert";
import { handleMiniAppStatic, resetMiniAppStaticCache } from "../src/miniapp-static.js";

class MockKV extends Map {
  constructor(entries) {
    super(entries);
    this.reads = new Map();
  }

  async get(key, type) {
    this.reads.set(key, (this.reads.get(key) || 0) + 1);
    const value = super.get(key);
    if (type === "json" && typeof value === "string") return JSON.parse(value);
    return value ?? null;
  }
}

const manifest = {
  assets: {
    "assets/app-a.js": {
      bytes: 11,
      content_type: "application/javascript; charset=utf-8",
      sha256: "a",
    },
    "assets/app-b.js": {
      bytes: 11,
      content_type: "application/javascript; charset=utf-8",
      sha256: "b",
    },
  },
};

let kv = new MockKV([
  ["miniapp:asset-manifest", JSON.stringify(manifest)],
  ["miniapp:asset:index.html", new TextEncoder().encode("<html></html>").buffer],
  ["miniapp:asset:assets/app-a.js", new TextEncoder().encode("console.log(1)").buffer],
]);
let env = { ALERTS_KV: kv, MINI_APP_MANIFEST_CACHE_SECONDS: "60" };

let response = await handleMiniAppStatic(new Request("https://worker.example/mini-app/assets/app-a.js"), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get("Content-Type"), "application/javascript; charset=utf-8");

response = await handleMiniAppStatic(new Request("https://worker.example/mini-app/assets/missing.js"), env);
assert.equal(response.status, 404);

await handleMiniAppStatic(new Request("https://worker.example/mini-app/alerts"), env);
assert.equal(kv.reads.get("miniapp:asset-manifest"), 1);

const noCacheKv = new MockKV([
  ["miniapp:asset-manifest", JSON.stringify(manifest)],
  ["miniapp:asset:index.html", new TextEncoder().encode("<html></html>").buffer],
  ["miniapp:asset:assets/app-a.js", new TextEncoder().encode("console.log(1)").buffer],
]);
resetMiniAppStaticCache();
env = { ALERTS_KV: noCacheKv, MINI_APP_MANIFEST_CACHE_SECONDS: "0" };
await handleMiniAppStatic(new Request("https://worker.example/mini-app/assets/app-a.js"), env);
await handleMiniAppStatic(new Request("https://worker.example/mini-app/assets/app-a.js"), env);
assert.equal(noCacheKv.reads.get("miniapp:asset-manifest"), 2);

console.log("mini-app static tests passed");
