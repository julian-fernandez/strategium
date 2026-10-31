import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type CatalogueFile, Catalogues } from "../shared/bsdata/catalogues";
import { COMPILER_VERSION, type FactionBundle } from "../shared/bundle";
import { compactBundle, hydrateBundle, type StoredBundle } from "../shared/compact";
import { parseBsdataFile } from "../shared/compile/bsdataSchema";
import { compileFaction } from "../shared/compile/faction";
import { findFaction } from "../shared/factions";
import {
  buildWahapedia,
  WAHAPEDIA_FILES,
  type Wahapedia,
  type WahapediaFile,
} from "../shared/wahapedia";
import {
  CACHE_DIR,
  getBsdataCatalogue,
  getBsdataCatalogueNames,
  readMeta,
  readWahapediaFile,
  syncWahapedia,
  wahapediaFilePath,
  writeMeta,
} from "./store";
import { onDataChanged } from "./updates";

const GAME_SYSTEM = "Warhammer 40,000";
const BUNDLE_DIR = path.join(CACHE_DIR, "bundles");

let wahapediaCache: { key: string; data: Wahapedia } | undefined;
const bundleCache = new Map<string, Promise<StoredBundle>>();

onDataChanged(() => {
  wahapediaCache = undefined;
  bundleCache.clear();
});

/** A faction's bundle ready to build armies from, for scripts that resolve lists on the server. */
export async function loadFactionBundle(requested: string): Promise<FactionBundle> {
  return hydrateBundle(await loadBundle(requested));
}

/**
 * A faction's bundle from disk or a fresh compile, without keeping it in
 * memory: for the data audit, which goes through every faction.
 */
export async function readFactionBundle(requested: string): Promise<FactionBundle> {
  return hydrateBundle(await buildBundle(findFaction(requested)?.name ?? requested.trim()));
}

/** The compiled bundle for a faction, as it's stored and sent: from memory, disk, or a fresh compile. */
export function loadBundle(requested: string): Promise<StoredBundle> {
  // "T’au Empire", "Xenos - Tyranids" and "Imperial Agents" all name one bundle.
  const faction = findFaction(requested)?.name ?? requested.trim();
  const key = faction.toLowerCase();
  let pending = bundleCache.get(key);
  if (!pending) {
    pending = buildBundle(faction).catch((error) => {
      bundleCache.delete(key);
      throw error;
    });
    bundleCache.set(key, pending);
  }
  return pending;
}

async function buildBundle(faction: string): Promise<StoredBundle> {
  const meta = await readMeta();
  const sha = meta.bsdata?.sha;
  if (!sha || !meta.wahapedia) throw new Error("No data yet. Run `pnpm sync-data` first.");

  const names = await getBsdataCatalogueNames(sha);
  const catalogue = pickFactionCatalogue(names, faction);
  if (!catalogue) throw new Error(`BSData has no catalogue for "${faction}".`);

  const version = `v${COMPILER_VERSION}-${sha.slice(0, 12)}-${meta.wahapedia.dir}`;
  const file = path.join(BUNDLE_DIR, version, `${slug(catalogue)}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8")) as StoredBundle;

  const started = performance.now();
  const { bundle: compiled, stats } = compileFaction({
    faction,
    catalogue,
    catalogues: await loadCatalogues(sha, names, catalogue),
    wahapedia: await loadWahapedia(),
    bsdataSha: sha,
  });
  const bundle = compactBundle(compiled);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(bundle));
  await prune(BUNDLE_DIR, version);
  console.log(
    `Compiled ${catalogue}: ${stats.units} units, ${stats.modifiersApplied} modifiers applied, ` +
      `${stats.modifiersSkipped} skipped, ${Math.round(performance.now() - started)} ms`,
  );
  return bundle;
}

/** The faction's catalogue, every library it links (recursively), and the game system file. */
export async function loadCatalogues(
  sha: string,
  names: string[],
  catalogue: string,
): Promise<Catalogues> {
  const files: CatalogueFile[] = [];
  const queue = [catalogue];
  const seen = new Set<string>();
  while (queue.length) {
    const name = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const root = parseBsdataFile(name, await getBsdataCatalogue(sha, name));
    files.push({ name, root, isGameSystem: false });
    for (const link of root.catalogueLinks ?? []) {
      const linked = await linkedCatalogue(sha, names, link);
      if (linked) queue.push(linked);
    }
  }
  files.push({
    name: GAME_SYSTEM,
    root: parseBsdataFile(GAME_SYSTEM, await getBsdataCatalogue(sha, GAME_SYSTEM)),
    isGameSystem: true,
  });
  return new Catalogues(files);
}

/**
 * The catalogue file a link points to. Link names go stale when a file is
 * renamed ("Chaos - Daemons Library" for "Chaos - Chaos Daemons Library"), so
 * a missing name falls back to files sharing its words, checked by id.
 */
async function linkedCatalogue(
  sha: string,
  names: string[],
  link: { name?: string; targetId?: string },
): Promise<string | undefined> {
  if (!link.name) return undefined;
  if (names.includes(link.name)) return link.name;
  const words = link.name.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const candidates = names.filter((name) => {
    const lower = name.toLowerCase();
    return words.every((word) => lower.includes(word));
  });
  for (const name of candidates) {
    const root = parseBsdataFile(name, await getBsdataCatalogue(sha, name));
    if (root.id === link.targetId) return name;
  }
  return undefined;
}

export async function loadWahapedia(): Promise<Wahapedia> {
  let meta = await readMeta();
  if (!meta.wahapedia) throw new Error("No Wahapedia data yet. Run `pnpm sync-data` first.");
  if (wahapediaCache?.key === meta.wahapedia.dir) return wahapediaCache.data;

  // A snapshot from before the app read a file: fetch the snapshot again.
  const snapshot = meta.wahapedia;
  if (WAHAPEDIA_FILES.some((file) => !existsSync(wahapediaFilePath(snapshot, file)))) {
    meta = await syncWahapedia(meta, snapshot.lastUpdate);
    await writeMeta(meta);
  }
  const current = meta.wahapedia ?? snapshot;
  const files = {} as Record<WahapediaFile, string>;
  for (const file of WAHAPEDIA_FILES) files[file] = await readWahapediaFile(current, file);
  const data = buildWahapedia(files);
  wahapediaCache = { key: current.dir, data };
  return data;
}

/**
 * Matches a list's faction line to a catalogue file name, e.g. "Adepta Sororitas"
 * to "Imperium - Adepta Sororitas". Prefers the playable catalogue over a library.
 */
export function pickFactionCatalogue(names: string[], faction: string): string | undefined {
  const known = findFaction(faction)?.catalogue;
  if (known && names.includes(known)) return known;
  const wanted = faction.trim().toLowerCase();
  const playable = names.filter((name) => !/library/i.test(name));
  for (const pool of [playable, names]) {
    const lower = pool.map((name) => name.toLowerCase());
    const exact = lower.indexOf(wanted);
    if (exact !== -1) return pool[exact];
    const suffix = lower.findIndex((name) => name.endsWith(` - ${wanted}`));
    if (suffix !== -1) return pool[suffix];
  }
  const partial = names.findIndex((name) => name.toLowerCase().includes(wanted));
  return partial === -1 ? undefined : names[partial];
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function prune(dir: string, keep: string): Promise<void> {
  for (const entry of await readdir(dir)) {
    if (entry !== keep) await rm(path.join(dir, entry), { recursive: true, force: true });
  }
}
