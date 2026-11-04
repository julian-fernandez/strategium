import { findFaction } from "./factions";
import { factionIconPath } from "./icons";

/**
 * Where the hosted site keeps each answer the API gives, relative to
 * `dist/data/`. scripts/build-site.ts writes these files and the Cloudflare
 * Worker (worker/index.ts) serves them, so both name them here.
 */
export const SITE_FILES = {
  meta: "meta.json",
  health: "health.json",
  coreRules: "core-rules.json",
};

/** A faction's bundle file, for a faction as a list names it; undefined for a name no faction has. */
export function bundleFile(faction: string): string | undefined {
  const name = findFaction(faction)?.name;
  return name ? `bundles/${fileSlug(name)}.json` : undefined;
}

/** A faction's emblem file; undefined when the icon set has no emblem for it. */
export function iconFile(faction: string): string | undefined {
  const name = findFaction(faction)?.name;
  return name && factionIconPath(name) ? `icons/${fileSlug(name)}.json` : undefined;
}

/** "T'au Empire" → "t-au-empire". */
function fileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
