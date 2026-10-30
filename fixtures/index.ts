import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { COMPILER_VERSION, type FactionBundle, factionBundleSchema } from "../shared/bundle";
import { hydrateBundle, type StoredBundle } from "../shared/compact";
import { findFaction } from "../shared/factions";
import type { Army } from "../shared/types";
import { comparable } from "../shared/wahapedia";

/**
 * Test data. `lists/` holds one real tournament list per faction (the
 * coverage set), `formats/` one list in every export format the app reads,
 * `bundles/` the trimmed faction bundles both run on, and `expected.json`
 * what each fixture resolves to. `pnpm coverage --write` regenerates the
 * bundles and expectations from synced data.
 */
export const FIXTURES_DIR = import.meta.dirname;
export const LISTS_DIR = path.join(FIXTURES_DIR, "lists");
export const FORMATS_DIR = path.join(FIXTURES_DIR, "formats");
export const BUNDLES_DIR = path.join(FIXTURES_DIR, "bundles");
export const EXPECTED_FILE = path.join(FIXTURES_DIR, "expected.json");

/** What a fixture resolves to, in a form worth comparing from run to run. */
export type FixtureSummary = {
  format: string;
  faction: string;
  detachments: string[];
  battleSize?: number;
  units: number;
  models: number;
  points: number;
  attachedGroups: number;
  stratagems: number;
  warnings: string[];
  crossCheck: string[];
};

export function summarize(army: Army): FixtureSummary {
  return {
    format: army.format?.id ?? "",
    faction: army.faction,
    detachments: army.detachments,
    battleSize: army.battleSize?.points,
    units: army.units.length,
    models: army.units.reduce((sum, unit) => sum + unit.modelCount, 0),
    points: army.units.reduce((sum, unit) => sum + unit.points, 0),
    attachedGroups: army.groups.length,
    stratagems: army.stratagems.length,
    warnings: army.warnings,
    crossCheck: army.crossCheck.map((i) => `${i.unit}: ${i.field} ${i.bsdata} / ${i.wahapedia}`),
  };
}

export type Fixture = { file: string; text: string };

export function fixtureFiles(dir: string): Fixture[] {
  return readdirSync(dir)
    .filter((file) => !file.startsWith("."))
    .sort()
    .map((file) => ({ file, text: readFileSync(path.join(dir, file), "utf8") }));
}

export function readFixture(dir: string, file: string): string {
  return readFileSync(path.join(dir, file), "utf8");
}

const bundles = new Map<string, FactionBundle>();

/** The committed bundle for a faction, matched by the list's faction name or the catalogue's. */
export function snapshotBundle(faction: string): FactionBundle {
  if (!bundles.size) {
    for (const { file, text } of fixtureFiles(BUNDLES_DIR)) {
      const json = JSON.parse(text) as { compilerVersion?: number };
      if (json.compilerVersion !== COMPILER_VERSION) {
        throw new Error(
          `fixtures/bundles/${file} is from compiler v${json.compilerVersion}, not v${COMPILER_VERSION}. ` +
            "Run `pnpm coverage --write` to recompile it.",
        );
      }
      const bundle = factionBundleSchema.parse(hydrateBundle(json as StoredBundle));
      bundles.set(bundle.catalogue, bundle);
    }
  }
  const catalogue = findFaction(faction)?.catalogue;
  const wanted = comparable(faction);
  for (const bundle of bundles.values()) {
    if (bundle.catalogue === catalogue || comparable(bundle.faction) === wanted) return bundle;
  }
  throw new Error(`No snapshot bundle for "${faction}". Run \`pnpm coverage --write\`.`);
}

export function bundleFileName(bundle: FactionBundle): string {
  return `${bundle.catalogue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.json`;
}
