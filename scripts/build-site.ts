/**
 * The hosted site's data, written next to the built web app in dist/data/
 * (run after `vite build`; `pnpm build:site` does both). It syncs BSData and
 * Wahapedia, audits the data, then asks the local API for every answer the
 * app can need (data versions, health, core rules, each faction's bundle and
 * emblem) and saves each response body as it is. The Cloudflare Worker
 * (worker/index.ts) serves those files, so the hosted app gets exactly what
 * the local server would send.
 *
 *   pnpm build:site             sync first
 *   pnpm build:site --no-sync   use the data already synced
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { app } from "../server/app";
import { checkDataHealth } from "../server/health";
import { checkForUpdates } from "../server/updates";
import { FACTIONS } from "../shared/factions";
import { bundleFile, iconFile, SITE_FILES } from "../shared/site";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "dist", "data");

if (!process.argv.includes("--no-sync")) {
  const meta = await checkForUpdates();
  if (meta.lastError)
    console.warn(`Sync failed, building from the data already synced: ${meta.lastError}`);
}
await checkDataHealth();

let bytes = 0;
let files = 0;

/** Saves the API's answer to `route` as `file`, failing on anything but a 200. */
async function save(route: string, file: string, edit = (body: string) => body): Promise<void> {
  const response = await app.request(route);
  const answer = await response.text();
  if (response.status !== 200)
    throw new Error(`${route} answered ${response.status}: ${answer.slice(0, 200)}`);
  const body = edit(answer);
  const target = path.join(DATA_DIR, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  bytes += Buffer.byteLength(body);
  files++;
}

// Stamped, so the app knows its data stays as it is until the next deploy.
await save("/api/meta", SITE_FILES.meta, (body) =>
  JSON.stringify({ ...JSON.parse(body), deployedAt: new Date().toISOString() }),
);
await save("/api/health", SITE_FILES.health);
await save("/api/core-rules", SITE_FILES.coreRules);

const factions = FACTIONS.filter((faction) => faction.catalogue);
for (const faction of factions) {
  const query = `faction=${encodeURIComponent(faction.name)}`;
  const bundle = bundleFile(faction.name);
  if (bundle) await save(`/api/bundle?${query}`, bundle);
  const icon = iconFile(faction.name);
  if (icon) await save(`/api/icon?${query}`, icon);
  process.stdout.write(".");
}

console.log(
  `\n${files} files (${(bytes / 1024 / 1024).toFixed(1)} MB) for ${factions.length} factions in ${path.relative(process.cwd(), DATA_DIR)}`,
);
// The update checker and the audit keep timers; the build is done.
process.exit(0);
