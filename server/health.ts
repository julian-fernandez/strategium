import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DataAudit, type DataHealth } from "../shared/audit";
import { COMPILER_VERSION } from "../shared/bundle";
import { FACTIONS } from "../shared/factions";
import { loadCoreRules } from "./coreRules";
import { readFactionBundle } from "./data";
import { CACHE_DIR, readMeta } from "./store";
import { onDataChanged } from "./updates";

/**
 * The data audit (shared/audit.ts), run on the server whenever the data or the
 * compiler changes, so the Data tab can say whether the latest BSData and
 * Wahapedia update left anything that would show wrong. It goes through every
 * faction one at a time, letting requests in between, and keeps the result on
 * disk so a restart doesn't repeat it.
 */
const HEALTH_PATH = path.join(CACHE_DIR, "health.json");

let latest: DataHealth | undefined;
let running: Promise<DataHealth | undefined> | undefined;

onDataChanged(() => {
  void checkDataHealth();
});

/** The latest audit, and whether a newer one is under way; starts one when the data has moved on. */
export async function dataHealth(): Promise<{ health: DataHealth | null; running: boolean }> {
  latest ??= await readSaved();
  if (!running && !(latest && (await isCurrent(latest)))) void checkDataHealth();
  return { health: latest ?? null, running: Boolean(running) };
}

/** Audits every faction. Concurrent calls share one run. */
export function checkDataHealth(): Promise<DataHealth | undefined> {
  running ??= audit()
    .then(async (health) => {
      if (!health) return undefined;
      latest = health;
      await writeFile(HEALTH_PATH, JSON.stringify(health));
      return health;
    })
    .catch((error) => {
      console.warn(`Data audit failed: ${error instanceof Error ? error.message : error}`);
      return undefined;
    })
    .finally(() => {
      running = undefined;
    });
  return running;
}

async function audit(): Promise<DataHealth | undefined> {
  const meta = await readMeta();
  if (!meta.bsdata || !meta.wahapedia) return undefined;
  const started = performance.now();
  const auditor = new DataAudit();
  for (const faction of FACTIONS.filter((f) => f.catalogue)) {
    try {
      auditor.add(faction.name, await readFactionBundle(faction.name));
    } catch (error) {
      auditor.failed(faction.name, error);
    }
    // A faction can take a second to compile; let waiting requests through between them.
    await new Promise((resolve) => setImmediate(resolve));
  }
  auditor.coreRules(await loadCoreRules());
  const health = auditor.result({
    bsdataSha: meta.bsdata.sha,
    wahapediaUpdate: meta.wahapedia.lastUpdate,
  });
  console.log(
    `Data audit: ${health.errors} errors, ${health.factions} factions, ` +
      `${Math.round(performance.now() - started)} ms`,
  );
  return health;
}

/** Whether an audit was of the data and compiler in use now. */
async function isCurrent(health: DataHealth): Promise<boolean> {
  const meta = await readMeta();
  return (
    health.compilerVersion === COMPILER_VERSION &&
    health.bsdataSha === meta.bsdata?.sha &&
    health.wahapediaUpdate === meta.wahapedia?.lastUpdate
  );
}

async function readSaved(): Promise<DataHealth | undefined> {
  if (!existsSync(HEALTH_PATH)) return undefined;
  try {
    return JSON.parse(await readFile(HEALTH_PATH, "utf8")) as DataHealth;
  } catch {
    return undefined;
  }
}
