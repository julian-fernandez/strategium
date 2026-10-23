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
 * Asks Wahapedia and BSData for their latest version and syncs whatever changed.
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

  try {
    const [stamp, head] = await Promise.all([fetchWahapediaLastUpdate(), fetchBsdataHead()]);

    if (meta.wahapedia?.lastUpdate !== stamp) {
      meta = await syncWahapedia(meta, stamp);
      changed = true;
    }

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

    meta.lastError = undefined;
  } catch (error) {
    meta.lastError = error instanceof Error ? error.message : String(error);
  }

  meta.checkedAt = new Date().toISOString();
  if (changed) meta.changedAt = meta.checkedAt;
  await writeMeta(meta);

  if (changed) for (const listener of listeners) listener(meta);
  return meta;
}
