import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const outfile = path.join(root, "dist", "assets", "legacy-app.js");
const htmlPath = path.join(root, "dist", "index.html");

await build({
  entryPoints: [path.join(root, "src", "legacy-main.tsx")],
  bundle: true,
  format: "iife",
  globalName: "NovaxLegacyApp",
  outfile,
  platform: "browser",
  target: "es2015",
  minify: true,
  jsx: "automatic",
  define: {
    "import.meta.env.VITE_NOVAX_API_BASE": JSON.stringify(process.env.VITE_NOVAX_API_BASE || ""),
    "import.meta.env.VITE_NOVAX_CHAT_API_BASE": JSON.stringify(process.env.VITE_NOVAX_CHAT_API_BASE || ""),
  },
});

const html = await readFile(htmlPath, "utf8");
if (!html.includes("/mini-app/assets/legacy-app.js")) {
  await writeFile(
    htmlPath,
    html.replace("</body>", '    <script defer src="/mini-app/assets/legacy-app.js"></script>\n  </body>'),
  );
}

console.log(JSON.stringify({ legacy: "dist/assets/legacy-app.js" }));
