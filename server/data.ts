import { type BsNode, type CatalogueFile, Catalogues } from "../shared/bsdata/catalogues";
import {
  buildWahapedia,
  WAHAPEDIA_FILES,
  type Wahapedia,
  type WahapediaFile,
} from "../shared/wahapedia";
import { getBsdataCatalogue, getBsdataCatalogueNames, readMeta, readWahapediaFile } from "./store";
import { onDataChanged } from "./updates";

const GAME_SYSTEM = "Warhammer 40,000";

let wahapediaCache: { key: string; data: Wahapedia } | undefined;
const catalogueCache = new Map<string, Catalogues>();

onDataChanged(() => {
  wahapediaCache = undefined;
  catalogueCache.clear();
});

export async function loadWahapedia(): Promise<Wahapedia> {
  const meta = await readMeta();
  if (!meta.wahapedia) throw new Error("No Wahapedia data yet. Run `pnpm sync-data` first.");
  if (wahapediaCache?.key === meta.wahapedia.dir) return wahapediaCache.data;

  const files = {} as Record<WahapediaFile, string>;
  for (const file of WAHAPEDIA_FILES) files[file] = await readWahapediaFile(meta.wahapedia, file);
  const data = buildWahapedia(files);
  wahapediaCache = { key: meta.wahapedia.dir, data };
  return data;
}

/** The faction's catalogue, every library it links (recursively) and the game system file. */
export async function loadCatalogues(faction: string): Promise<Catalogues> {
  const meta = await readMeta();
  const sha = meta.bsdata?.sha;
  if (!sha) throw new Error("No BSData commit yet. Run `pnpm sync-data` first.");

  const key = `${sha}:${faction}`;
  const cached = catalogueCache.get(key);
  if (cached) return cached;

  const names = await getBsdataCatalogueNames(sha);
  const factionName = pickFactionCatalogue(names, faction);
  if (!factionName) throw new Error(`BSData has no catalogue for "${faction}".`);

  const files: CatalogueFile[] = [];
  const queue = [factionName];
  const seen = new Set<string>();
  while (queue.length) {
    const name = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const root = rootOf(await getBsdataCatalogue(sha, name));
    files.push({ name, root, isGameSystem: false });
    for (const link of root.catalogueLinks ?? []) {
      if (link.name && names.includes(link.name)) queue.push(link.name);
    }
  }
  files.push({
    name: GAME_SYSTEM,
    root: rootOf(await getBsdataCatalogue(sha, GAME_SYSTEM)),
    isGameSystem: true,
  });

  const catalogues = new Catalogues(files);
  catalogueCache.set(key, catalogues);
  return catalogues;
}

/**
 * Matches a list's faction line to a catalogue file name, e.g. "Adepta Sororitas"
 * to "Imperium - Adepta Sororitas". Prefers the playable catalogue over a library.
 */
export function pickFactionCatalogue(names: string[], faction: string): string | undefined {
  const wanted = faction.trim().toLowerCase();
  const lower = names.map((name) => name.toLowerCase());
  const exact = lower.indexOf(wanted);
  if (exact !== -1) return names[exact];
  const suffix = lower.findIndex((name) => name.endsWith(` - ${wanted}`));
  if (suffix !== -1) return names[suffix];
  const library = lower.findIndex((name) => name.includes(wanted));
  return library === -1 ? undefined : names[library];
}

function rootOf(json: unknown): BsNode {
  const root = Object.values(json as Record<string, BsNode>)[0];
  if (!root) throw new Error("Empty BSData catalogue");
  return root;
}
