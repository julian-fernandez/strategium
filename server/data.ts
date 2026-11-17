import { createHash } from "node:crypto";
import { existsSync, mkdirSync, watch } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type CatalogueFile, Catalogues } from "../shared/bsdata/catalogues";
import { COMPILER_VERSION, type FactionBundle, factionBundleSchema } from "../shared/bundle";
import { compactBundle, hydrateBundle, type StoredBundle } from "../shared/compact";
import { parseBsdataFile } from "../shared/compile/bsdataSchema";
import { compileFaction, crossCheckUnit } from "../shared/compile/faction";
import { findFaction } from "../shared/factions";
import { applyOverrides, type Overrides, overridesSchema } from "../shared/overrides";
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
  // The faction's overrides are part of its name on disk, so editing them recompiles it.
  const overrides = await readOverrides(slug(catalogue));
  const suffix = overrides ? `.o${overrides.fingerprint}` : "";
  const file = path.join(BUNDLE_DIR, version, `${slug(catalogue)}${suffix}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8")) as StoredBundle;

  const started = performance.now();
  const wahapedia = await loadWahapedia();
  let { bundle: compiled, stats } = compileFaction({
    faction,
    catalogue,
    catalogues: await loadCatalogues(sha, names, catalogue),
    wahapedia,
    bsdataSha: sha,
  });
  if (overrides) {
    const applied = applyOverrides(compiled, overrides.data);
    // What changed is compared with Wahapedia again, so the cross-check reports today's numbers.
    for (const key of applied.changed) {
      const unit = applied.bundle.units[key];
      if (unit?.wahapedia) unit.crossCheck = crossCheckUnit(wahapedia, unit.wahapedia.id, unit);
    }
    compiled = factionBundleSchema.parse({
      ...applied.bundle,
      sources: { ...applied.bundle.sources, overrides: overrides.fingerprint },
    });
    stats = { ...stats, units: Object.keys(compiled.units).length };
  }
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

/** Private corrections to the frozen data, one file per faction (see shared/overrides.ts). */
export const OVERRIDES_DIR = path.join(CACHE_DIR, "..", "overrides");

/** One fingerprint for every faction's overrides together, or none when there are none. */
export async function overridesFingerprint(): Promise<string | undefined> {
  if (!existsSync(OVERRIDES_DIR)) return undefined;
  const files = (await readdir(OVERRIDES_DIR)).filter((file) => file.endsWith(".json")).sort();
  if (!files.length) return undefined;
  const hash = createHash("sha256");
  for (const file of files)
    hash.update(file).update(await readFile(path.join(OVERRIDES_DIR, file)));
  return hash.digest("hex").slice(0, 10);
}

// An edited override takes effect without a restart: the next request compiles again.
// Unreferenced, so a script that reads bundles still exits when it's done.
mkdirSync(OVERRIDES_DIR, { recursive: true });
watch(OVERRIDES_DIR, () => bundleCache.clear()).unref();

/** A faction's overrides and a fingerprint of them, if it has any. */
async function readOverrides(
  name: string,
): Promise<{ data: Overrides; fingerprint: string } | undefined> {
  const file = path.join(OVERRIDES_DIR, `${name}.json`);
  if (!existsSync(file)) return undefined;
  const text = await readFile(file, "utf8");
  const parsed = overridesSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`data/overrides/${name}.json isn't valid: ${parsed.error.message}`);
  }
  return {
    data: parsed.data,
    fingerprint: createHash("sha256").update(text).digest("hex").slice(0, 10),
  };
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
