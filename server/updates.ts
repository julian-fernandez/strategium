import { BSDATA_FROZEN } from "../shared/config";
import { fetchBsdataHead, fetchWahapediaLastUpdate } from "./sources";
import {
  cachedBsdataCatalogues,
  getBsdataCatalogue,
  type Meta,
  pinBsdataCommit,
  readMeta,
  syncWahapedia,
  writeMeta,
} from "./store";

type Listener = (meta: Meta) => void;

const listeners = new Set<Listener>();
let running: Promise<Meta> | null = null;

/** Called whenever a check brings in new data. */
export function onDataChanged(listener: Listener): void {
  listeners.add(listener);
}

/**
 * Asks Wahapedia and BSData for their latest version and syncs whatever changed,
 * each on its own.
 * Concurrent calls share one run.
 */
export function checkForUpdates(): Promise<Meta> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<Meta> {
  let meta = await readMeta();
  let changed = false;

  // Each source on its own, so one that fails (BSData since GW's takedown) doesn't stop the
  // other from updating. Either's error is kept for the Data tab.
  const errors: string[] = [];
  const attempt = async (source: string, step: () => Promise<void>) => {
    try {
      await step();
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await attempt("Wahapedia", async () => {
    const stamp = await fetchWahapediaLastUpdate();
    if (meta.wahapedia?.lastUpdate !== stamp) {
      meta = await syncWahapedia(meta, stamp);
      changed = true;
    }
  });

  // BSData stays on its frozen commit, which is never replaced or pruned.
  await attempt("BSData", async () => {
    if (BSDATA_FROZEN) {
      if (meta.bsdata?.sha !== BSDATA_FROZEN) {
        throw new Error(`frozen at ${BSDATA_FROZEN.slice(0, 7)}, which isn't in the cache`);
      }
      return;
    }
    const head = await fetchBsdataHead();
    if (meta.bsdata?.sha !== head.sha) {
      const previousSha = meta.bsdata?.sha;
      meta = await pinBsdataCommit(meta, head);
      // Fetch the catalogues already in use, so the next list loads without waiting.
      if (previousSha) {
        for (const name of await cachedBsdataCatalogues(previousSha)) {
          await getBsdataCatalogue(head.sha, name);
        }
      }
      changed = true;
    }
  });

  meta.lastError = errors.length ? errors.join("; ") : undefined;

  meta.checkedAt = new Date().toISOString();
  if (changed) meta.changedAt = meta.checkedAt;
  await writeMeta(meta);

  if (changed) for (const listener of listeners) listener(meta);
  return meta;
}
