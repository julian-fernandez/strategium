import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readList } from "../shared/list/formats";
import { buildArmy } from "../shared/resolve/army";
import {
  EXPECTED_FILE,
  type FixtureSummary,
  FORMATS_DIR,
  fixtureFiles,
  LISTS_DIR,
  snapshotBundle,
  summarize,
} from ".";

/**
 * Every fixture, read and built on the committed bundles, must resolve
 * exactly as it did when `pnpm coverage --write` last ran against live data:
 * same format, units, points, stratagems, and the same (known) warnings.
 */
const expected = JSON.parse(readFileSync(EXPECTED_FILE, "utf8")) as Record<string, FixtureSummary>;
const load = async (faction: string) => snapshotBundle(faction);

describe.each([
  ["lists", LISTS_DIR],
  ["formats", FORMATS_DIR],
] as const)("fixtures/%s", (label, dir) => {
  it.each(fixtureFiles(dir).map((f) => [f.file, f.text] as const))("%s", async (file, text) => {
    const { list, format, bundle } = await readList(text, load);
    const summary = summarize(buildArmy(list, bundle, {}, format));
    expect(summary).toEqual(expected[`${label}/${file}`]);
  });
});

describe("the coverage set", () => {
  it("has a list for every faction BSData has a catalogue for", () => {
    const factions = new Set(Object.values(expected).map((s) => s.faction));
    expect(factions.size).toBeGreaterThanOrEqual(34);
  });

  it("reads a list in every export format seen in the wild", () => {
    const formats = new Set(Object.values(expected).map((s) => s.format));
    for (const id of [
      "gw-app",
      "nr-wtc-compact",
      "nr-text",
      "wtc",
      "listforge",
      "warmind",
      "warorgan",
      "ironbuilt",
      "40kapp",
      "roster-xml",
      "roster-json",
    ]) {
      expect(formats).toContain(id);
    }
  });
});
