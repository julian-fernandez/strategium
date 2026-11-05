/**
 * The Vercel deployment, in Vercel's Build Output API layout (.vercel/output):
 * the built site from `pnpm build:site` (run first) as static files, and the
 * hosted API (vercel/api.ts) bundled into one self-contained edge function,
 * placed at each API path the app calls. Vercel runs `pnpm build:vercel` and
 * deploys what this leaves; it's bundled here because Vercel's own functions
 * run the sources as Node ESM, which needs file extensions on every import.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "vite";
import { HOSTED_ROUTES } from "../server/hosted";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(ROOT, ".vercel", "output");
const BUNDLE_DIR = path.join(ROOT, ".vercel", "api-bundle");

await rm(OUTPUT, { recursive: true, force: true });
await cp(path.join(ROOT, "dist"), path.join(OUTPUT, "static"), { recursive: true });

await build({
  configFile: false,
  root: ROOT,
  publicDir: false,
  logLevel: "warn",
  build: {
    ssr: path.join(ROOT, "vercel", "api.ts"),
    outDir: BUNDLE_DIR,
    emptyOutDir: true,
    minify: true,
    rollupOptions: { output: { format: "es", entryFileNames: "index.js" } },
  },
  ssr: { noExternal: true, target: "webworker" },
});
const code = await readFile(path.join(BUNDLE_DIR, "index.js"));

for (const route of HOSTED_ROUTES) {
  const dir = path.join(OUTPUT, "functions", "api", `${route}.func`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.js"), code);
  await writeFile(
    path.join(dir, ".vc-config.json"),
    JSON.stringify({ runtime: "edge", entrypoint: "index.js" }),
  );
}
await writeFile(path.join(OUTPUT, "config.json"), JSON.stringify({ version: 3 }));
console.log(
  `.vercel/output: the site, and the API (${(code.length / 1024).toFixed(0)} KB) at ${HOSTED_ROUTES.length} paths`,
);
