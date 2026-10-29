/**
 * The coverage harness. Reads every fixture, one real tournament list per
 * faction (fixtures/lists) and one per export format (fixtures/formats),
 * against the synced data, and reports what didn't resolve cleanly: warnings,
 * and stats or weapons where BSData and Wahapedia disagree.
 *
 * With --write it also refreshes what the tests run on: the trimmed bundles
 * in fixtures/bundles (every unit any fixture uses, no rules text) and the
 * expected summaries in fixtures/expected.json, so a change in how any list
 * resolves shows up as a test failure.
 *
 *   pnpm coverage            report
 *   pnpm coverage --write    report, then rewrite fixtures/bundles and expected.json
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BUNDLES_DIR,
  bundleFileName,
  EXPECTED_FILE,
  type FixtureSummary,
  FORMATS_DIR,
  fixtureFiles,
  LISTS_DIR,
  summarize,
} from "../fixtures";
import { loadBundle } from "../server/data";
import type { FactionBundle } from "../shared/bundle";
import { trimBundle } from "../shared/compile/trim";
import { readList } from "../shared/list/formats";
import { buildArmy } from "../shared/resolve/army";
import { findUnit } from "../shared/resolve/datasheet";

const write = process.argv.includes("--write");
const used = new Map<string, { bundle: FactionBundle; keys: Set<string> }>();
const expected: Record<string, FixtureSummary> = {};
let errors = 0;
let clean = 0;
let total = 0;

for (const [dir, label] of [
  [LISTS_DIR, "lists"],
  [FORMATS_DIR, "formats"],
] as const) {
  for (const { file, text } of fixtureFiles(dir)) {
    const id = `${label}/${file}`;
    total++;
    try {
      const { list, format, bundle } = await readList(text, loadBundle);
      const army = buildArmy(list, bundle, {}, format);
      const summary = summarize(army);
      expected[id] = summary;
      const problems = [
        ...army.warnings,
        ...army.crossCheck.map(
          (i) => `${i.unit}: ${i.field} is ${i.bsdata} in BSData, ${i.wahapedia} on Wahapedia`,
        ),
      ];
      if (!problems.length) clean++;
      console.log(
        `${problems.length ? "!" : "✓"} ${id}: ${format.label} · ${army.faction} · ` +
          `${summary.units} units, ${summary.points} pts, ${summary.stratagems} stratagems`,
      );
      for (const problem of problems) console.log(`    ${problem}`);

      const entry = used.get(bundle.catalogue) ?? { bundle, keys: new Set<string>() };
      for (const unit of army.units) {
        const found = findUnit(bundle, unit.name);
        const key = Object.entries(bundle.units).find(([, u]) => u === found)?.[0];
        if (key) entry.keys.add(key);
      }
      used.set(bundle.catalogue, entry);
    } catch (error) {
      errors++;
      console.log(`✗ ${id}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

if (write) {
  rmSync(BUNDLES_DIR, { recursive: true, force: true });
  mkdirSync(BUNDLES_DIR, { recursive: true });
  for (const { bundle, keys } of used.values()) {
    const file = path.join(BUNDLES_DIR, bundleFileName(bundle));
    writeFileSync(file, `${JSON.stringify(trimBundle(bundle, keys))}\n`);
  }
  writeFileSync(EXPECTED_FILE, `${JSON.stringify(expected, null, 2)}\n`);
  console.log(
    `Wrote ${used.size} trimmed bundles and ${Object.keys(expected).length} expected summaries.`,
  );
}

console.log(
  `${clean} of ${total} lists resolved with no warnings and no cross-check differences` +
    (errors ? `; ${errors} couldn't be read.` : "."),
);
process.exitCode = errors ? 1 : 0;
