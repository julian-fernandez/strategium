/**
 * Audits everything the compiled data can show, for every faction (see
 * shared/audit.ts for what counts as an error and what as a note). Needs the
 * data synced (`pnpm dev` or `pnpm sync-data` once); compiles any faction it
 * hasn't yet. The server runs the same audit after each data update.
 *
 *   pnpm data-check            every faction
 *   pnpm data-check Orks Necrons
 *   pnpm data-check --notes    list the notes too, not just count them
 */
import { loadFactionBundle } from "../server/data";
import { readMeta } from "../server/store";
import { DataAudit } from "../shared/audit";
import { FACTIONS } from "../shared/factions";

const EXAMPLES = 8;

const args = process.argv.slice(2);
const showNotes = args.includes("--notes");
const wanted = args.filter((arg) => !arg.startsWith("--"));
const factions = FACTIONS.filter(
  (faction) =>
    faction.catalogue &&
    (wanted.length === 0 || wanted.some((w) => w.toLowerCase() === faction.name.toLowerCase())),
);

const audit = new DataAudit();
for (const faction of factions) {
  try {
    audit.add(faction.name, await loadFactionBundle(faction.name));
  } catch (error) {
    audit.failed(faction.name, error);
  }
}
const meta = await readMeta();
const health = audit.result({
  bsdataSha: meta.bsdata?.sha,
  wahapediaUpdate: meta.wahapedia?.lastUpdate,
});

console.log(
  `${health.factions} factions: ${health.units} distinct units, ${health.stratagems} stratagems, ${health.detachments} detachments.\n`,
);
for (const { kind, severity, places } of health.findings) {
  console.log(`${severity === "error" ? "✗" : "·"} ${kind}: ${places.length}`);
  if (severity === "error" || showNotes) {
    const shown = showNotes ? places : places.slice(0, EXAMPLES);
    for (const place of shown) console.log(`    ${place}`);
    if (places.length > shown.length) console.log(`    … and ${places.length - shown.length} more`);
  }
}
console.log(health.errors ? `\n${health.errors} errors.` : "\nNo errors.");
if (health.errors) process.exitCode = 1;
