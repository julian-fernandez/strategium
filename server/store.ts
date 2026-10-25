import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  fetchBsdataCatalogue,
  fetchBsdataCatalogueNames,
  fetchWahapediaFile,
  WAHAPEDIA_FILES,
  type WahapediaFile,
} from "./sources";

export const CACHE_DIR = path.resolve(import.meta.dirname, "..", "data", "cache");
const META_PATH = path.join(CACHE_DIR, "meta.json");
const WAHAPEDIA_DIR = path.join(CACHE_DIR, "wahapedia");
const BSDATA_DIR = path.join(CACHE_DIR, "bsdata");

export type WahapediaSnapshot = { lastUpdate: string; dir: string; syncedAt: string };
export type BsdataSnapshot = { sha: string; date: string; syncedAt: string };

export type Meta = {
  wahapedia?: WahapediaSnapshot;
  wahapediaPrevious?: WahapediaSnapshot;
  bsdata?: BsdataSnapshot;
  bsdataPrevious?: BsdataSnapshot;
  /** When the server last asked both sources for their latest version. */
  checkedAt?: string;
  /** When either source last changed, so the web app knows to refresh. */
  changedAt?: string;
  lastError?: string;
};

export async function readMeta(): Promise<Meta> {
  if (!existsSync(META_PATH)) return {};
  return JSON.parse(await readFile(META_PATH, "utf8")) as Meta;
}

export async function writeMeta(meta: Meta): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(META_PATH, `${JSON.stringify(meta, null, 2)}\n`);
}

/** Downloads every Wahapedia file into a new snapshot and keeps the previous one. */
export async function syncWahapedia(meta: Meta, lastUpdate: string): Promise<Meta> {
  const dir = lastUpdate.replace(/[^0-9]+/g, "-").replace(/-$/, "");
  const target = path.join(WAHAPEDIA_DIR, dir);
  const staging = `${target}.partial`;

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  for (const file of WAHAPEDIA_FILES) {
    await writeFile(path.join(staging, `${file}.csv`), await fetchWahapediaFile(file));
  }
  await rm(target, { recursive: true, force: true });
  await rename(staging, target);

  const previous = meta.wahapedia?.dir === dir ? meta.wahapediaPrevious : meta.wahapedia;
  const next: Meta = {
    ...meta,
    wahapedia: { lastUpdate, dir, syncedAt: new Date().toISOString() },
    wahapediaPrevious: previous,
  };
  await prune(WAHAPEDIA_DIR, [dir, previous?.dir]);
  return next;
}

/** Points the cache at a new BSData commit. Catalogues are fetched on first use. */
export async function pinBsdataCommit(
  meta: Meta,
  head: { sha: string; date: string },
): Promise<Meta> {
  if (meta.bsdata?.sha === head.sha) return meta;
  const previous = meta.bsdata;
  const next: Meta = {
    ...meta,
    bsdata: { ...head, syncedAt: new Date().toISOString() },
    bsdataPrevious: previous,
  };
  await prune(BSDATA_DIR, [head.sha, previous?.sha]);
  return next;
}

export function wahapediaFilePath(snapshot: WahapediaSnapshot, file: WahapediaFile): string {
  return path.join(WAHAPEDIA_DIR, snapshot.dir, `${file}.csv`);
}

export async function readWahapediaFile(
  snapshot: WahapediaSnapshot,
  file: WahapediaFile,
): Promise<string> {
  return readFile(wahapediaFilePath(snapshot, file), "utf8");
}

export async function getBsdataCatalogueNames(sha: string): Promise<string[]> {
  const cached = path.join(BSDATA_DIR, sha, "_catalogues.json");
  if (existsSync(cached)) return JSON.parse(await readFile(cached, "utf8")) as string[];
  const names = await fetchBsdataCatalogueNames(sha);
  await mkdir(path.dirname(cached), { recursive: true });
  await writeFile(cached, JSON.stringify(names));
  return names;
}

export async function getBsdataCatalogue(sha: string, name: string): Promise<unknown> {
  const cached = path.join(BSDATA_DIR, sha, `${name}.json`);
  if (!existsSync(cached)) {
    const text = await fetchBsdataCatalogue(sha, name);
    await mkdir(path.dirname(cached), { recursive: true });
    await writeFile(cached, text);
  }
  return JSON.parse(await readFile(cached, "utf8"));
}

/** Catalogues already downloaded for a commit, so a new commit can prefetch the same ones. */
export async function cachedBsdataCatalogues(sha: string): Promise<string[]> {
  const dir = path.join(BSDATA_DIR, sha);
  if (!existsSync(dir)) return [];
  return (await readdir(dir))
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
    .map((file) => file.slice(0, -".json".length));
}

async function prune(dir: string, keep: (string | undefined)[]): Promise<void> {
  if (!existsSync(dir)) return;
  for (const entry of await readdir(dir)) {
    if (!keep.includes(entry)) await rm(path.join(dir, entry), { recursive: true, force: true });
  }
}
