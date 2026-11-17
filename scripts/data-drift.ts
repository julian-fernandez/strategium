/**
 * Where our data (BSData frozen on 11 November 2026, plus data/overrides) and
 * Wahapedia today disagree: points by squad size, later copies, option costs,
 * stat lines, weapon numbers and keywords, unit keywords, enhancement costs,
 * and Wahapedia datasheets we have no unit for. Each unit gets the overrides
 * that would bring it in line, ready to check and copy into
 * data/overrides/<faction>.json. Writes data/drift/report.md (never committed:
 * it quotes GW's numbers). Needs synced data, not `pnpm dev`.
 *
 *   pnpm data-drift                       every faction
 *   pnpm data-drift "Adepta Sororitas"    just these
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadFactionBundle, loadWahapedia } from "../server/data";
import { CACHE_DIR, readMeta } from "../server/store";
import type { FactionBundle } from "../shared/bundle";
import { type FactionDrift, factionDrift, newOnWahapedia } from "../shared/drift";
import { FACTIONS } from "../shared/factions";

const wanted = process.argv.slice(2).map((name) => name.toLowerCase());
const factions = FACTIONS.filter(
  (f) => f.catalogue && (wanted.length === 0 || wanted.includes(f.name.toLowerCase())),
);
if (!factions.length) {
  console.error(`No faction named ${process.argv.slice(2).join(", ")}.`);
  process.exit(1);
}

const meta = await readMeta();
const wahapedia = await loadWahapedia();
const bundles: FactionBundle[] = [];
const drifts: FactionDrift[] = [];
for (const faction of factions) {
  const bundle = await loadFactionBundle(faction.name);
  bundles.push(bundle);
  drifts.push(factionDrift(bundle, wahapedia));
}

// Space Marine chapters all share Wahapedia's Space Marines datasheets, so new
// datasheets are listed once for each of Wahapedia's factions.
const byWahapediaFaction = new Map<string, FactionBundle[]>();
for (const bundle of bundles) {
  const id = bundle.wahapediaFactionId ?? bundle.faction;
  byWahapediaFaction.set(id, [...(byWahapediaFaction.get(id) ?? []), bundle]);
}

// What's new since the last report: most differences are old disagreements between
// the sources, so a change on Wahapedia (a new points list) shows up as what's new.
const DRIFT_DIR = path.join(CACHE_DIR, "..", "drift");
const BASELINE = path.join(DRIFT_DIR, "findings.json");
type Baseline = Record<string, { date: string; keys: string[] }>;
const baseline: Baseline = existsSync(BASELINE)
  ? (JSON.parse(await readFile(BASELINE, "utf8")) as Baseline)
  : {};
const fresh: string[] = [];
for (const drift of drifts) {
  const before = baseline[drift.faction];
  const keys = [
    ...drift.units.flatMap((u) =>
      u.findings.map((f) => `${u.unit}: ${f.what}, ${f.ours} -> ${f.theirs}`),
    ),
    ...drift.enhancements.map((e) => `${e.what}, ${e.ours} -> ${e.theirs}`),
  ];
  if (before) {
    const known = new Set(before.keys);
    for (const key of keys) if (!known.has(key)) fresh.push(`${drift.faction} · ${key}`);
  }
  baseline[drift.faction] = { date: new Date().toISOString().slice(0, 10), keys };
}
const since = [...new Set(drifts.map((d) => baseline[d.faction]?.date))].join(", ");

const lines: string[] = [
  "# Changes since the frozen data",
  "",
  `BSData ${meta.bsdata?.sha.slice(0, 7)} (${meta.bsdata?.date.slice(0, 10)}), with overrides, against Wahapedia ${meta.wahapedia?.lastUpdate}.`,
  "Each change is Wahapedia's reading: check it against the points list or dataslate before copying the overrides.",
  "",
  `## New since the last report (${since})`,
  "",
  ...(fresh.length ? fresh.map((key) => `- ${key}`) : ["Nothing new."]),
  "",
];
let total = 0;
for (const drift of drifts) {
  const changed = drift.units.length + drift.enhancements.length;
  total += changed;
  if (!changed) continue;
  lines.push(`## ${drift.faction}`, "");
  for (const unit of drift.units) {
    lines.push(`### ${unit.unit}`, "", "| What | Ours | Wahapedia |", "| --- | --- | --- |");
    for (const f of unit.findings) lines.push(`| ${f.what} | ${f.ours} | ${f.theirs} |`);
    lines.push("", "```json", JSON.stringify({ [unit.unit]: unit.proposal }, null, 2), "```", "");
  }
  if (drift.enhancements.length) {
    lines.push("### Enhancements", "", "| Enhancement | Ours | Wahapedia |", "| --- | --- | --- |");
    for (const e of drift.enhancements) lines.push(`| ${e.name} | ${e.ours} | ${e.theirs} |`);
    const proposal = Object.fromEntries(drift.enhancements.map((e) => [e.name, e.cost]));
    lines.push("", "```json", JSON.stringify({ enhancements: proposal }, null, 2), "```", "");
  }
}

lines.push("## Datasheets Wahapedia has that our data doesn't", "");
let missing = 0;
for (const [, group] of byWahapediaFaction) {
  const names = newOnWahapedia(group, wahapedia);
  missing += names.length;
  if (names.length)
    lines.push(`- **${group.map((b) => b.faction).join(", ")}:** ${names.join("; ")}`);
}
lines.push("", "## Units priced by their models, so not compared by squad size", "");
for (const drift of drifts) {
  if (drift.unpriced.length) lines.push(`- **${drift.faction}:** ${drift.unpriced.join("; ")}`);
}
lines.push("", "## Units in our data Wahapedia doesn't have", "");
for (const drift of drifts) {
  if (drift.unmatched.length) lines.push(`- **${drift.faction}:** ${drift.unmatched.join("; ")}`);
}

const out = path.join(DRIFT_DIR, "report.md");
await mkdir(DRIFT_DIR, { recursive: true });
await writeFile(out, `${lines.join("\n")}\n`);
await writeFile(BASELINE, JSON.stringify(baseline));
for (const drift of drifts) {
  const count = drift.units.length + drift.enhancements.length;
  if (count)
    console.log(
      `${drift.faction}: ${drift.units.length} units, ${drift.enhancements.length} enhancements`,
    );
}
console.log(
  `\n${total} differences in ${factions.length} factions, ${fresh.length} new since the last report` +
    `, ${missing} datasheets new on Wahapedia -> ${out}`,
);
process.exit(0);
