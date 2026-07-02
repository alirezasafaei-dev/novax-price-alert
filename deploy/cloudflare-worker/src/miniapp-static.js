const DEFAULT_CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

let assetManifestCache = null;
let assetManifestCachedAt = 0;

function miniAppAssetKey(assetPath) {
  return `miniapp:asset:${assetPath}`;
}

function contentTypeFor(assetPath) {
  const extension = assetPath.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  return DEFAULT_CONTENT_TYPES[extension] || "application/octet-stream";
}

async function getAssetManifest(env) {
  const cacheSeconds = Number(env.MINI_APP_MANIFEST_CACHE_SECONDS ?? 60);
  if (
    assetManifestCache &&
    cacheSeconds > 0 &&
    Date.now() - assetManifestCachedAt < cacheSeconds * 1000
  ) {
    return assetManifestCache;
  }
  const manifest = await (env.ASSETS_KV || env.ALERTS_KV).get("miniapp:asset-manifest", "json");
  assetManifestCache = manifest && typeof manifest === "object" ? manifest : {};
  assetManifestCachedAt = Date.now();
  return assetManifestCache;
}

export function resetMiniAppStaticCache() {
  assetManifestCache = null;
  assetManifestCachedAt = 0;
}

export async function handleMiniAppStatic(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/mini-app")) return null;

  let assetPath = url.pathname.slice("/mini-app".length).replace(/^\//, "");
  if (!assetPath) assetPath = "index.html";
  if (!assetPath.includes(".")) assetPath = "index.html";

  const manifest = await getAssetManifest(env);
  const knownAsset = manifest.assets?.[assetPath];
  if (!knownAsset && assetPath !== "index.html") return new Response("Not Found", { status: 404 });

  const body = await (env.ASSETS_KV || env.ALERTS_KV).get(miniAppAssetKey(assetPath), "arrayBuffer");
  if (!body) {
    if (assetPath === "index.html") {
      // Visible diagnostic shell instead of opaque 503/blank page.
      const msg = "Mini-app assets are not deployed in KV yet. Run: bash deploy/cloudflare-worker/scripts/deploy-miniapp-worker-kv.sh";
      return new Response(
        `<!doctype html><html><body style="background:#060814;color:#fda4af;font-family:system-ui;padding:24px;direction:rtl">
          <h3 style="color:#fff">NovaX Mini App</h3>
          <p>${msg}</p>
          <p style="font-size:12px;opacity:.7">After running the script, hard-refresh or re-open the web app from the bot.</p>
        </body></html>`,
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    return new Response("Mini app asset not deployed", { status: 503 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": knownAsset?.content_type || contentTypeFor(assetPath),
      "Cache-Control": assetPath === "index.html" ? "no-store" : "public, max-age=31536000, immutable",
      "Content-Security-Policy": "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    },
  });
}
