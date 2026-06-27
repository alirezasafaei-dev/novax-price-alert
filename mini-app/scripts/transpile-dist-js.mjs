import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const distAssets = path.resolve(import.meta.dirname, "../dist/assets");
const entries = await readdir(distAssets, { withFileTypes: true });

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
  const filePath = path.join(distAssets, entry.name);
  const source = await readFile(filePath, "utf8");
  const result = await transform(source, {
    format: "esm",
    loader: "js",
    minify: true,
    target: "es2015",
  });
  await writeFile(filePath, result.code);
}

console.log(JSON.stringify({ transpiled: entries.filter((entry) => entry.isFile() && entry.name.endsWith(".js")).length }));
