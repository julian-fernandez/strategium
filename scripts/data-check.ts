/**
 * Audits everything the compiled data can show, for every faction: each
 * unit's stat lines, weapons and abilities, each stratagem, detachment rule,
 * enhancement and rule text. Needs the data synced (`pnpm dev` or
 * `pnpm sync-data` once); compiles any faction it hasn't yet.
 *
 * Errors are things a card or screen would show wrong: empty text, markup
 * left in it, a weapon or stat line with a blank column, a stratagem the
 * phase filter can't place. Notes are worth knowing but not wrong: a keyword
 * with no rule text behind it, a unit with no background text.
 *
 *   pnpm data-check            every faction
 *   pnpm data-check Orks Necrons
 *   pnpm data-check --notes    list the notes too, not just count them
 */
import { loadFactionBundle } from "../server/data";
import { type FactionBundle, type ItemData, ruleKey, type UnitData } from "../shared/bundle";
import { FACTIONS } from "../shared/factions";

const EXAMPLES = 8;
const PHASE = /command|movement|shooting|charge|fight|any/i;
const TURN = /your|opponent|either/i;

type Severity = "error" | "note";
/** One kind of finding, and every place it was found, each once however many factions share it. */
const findings = new Map<string, { severity: Severity; places: Map<string, Set<string>> }>();

const args = process.argv.slice(2);
const showNotes = args.includes("--notes");
const wanted = args.filter((arg) => !arg.startsWith("--"));
const factions = FACTIONS.filter(
  (faction) =>
    faction.catalogue &&
    (wanted.length === 0 || wanted.some((w) => w.toLowerCase() === faction.name.toLowerCase())),
);

let units = 0;
let stratagems = 0;
let detachments = 0;
const seenUnits = new Set<string>();
for (const faction of factions) {
  let bundle: FactionBundle;
  try {
    bundle = await loadFactionBundle(faction.name);
  } catch (error) {
    found("error", "faction didn't compile", faction.name, String(error).split("\n")[0] ?? "");
    continue;
  }
  for (const unit of Object.values(bundle.units)) {
    // Library units (Imperial Agents, the Space Marine core) appear in many bundles; check each once.
    const id = `${unit.name}|${unit.keywords.join(",")}`;
    if (seenUnits.has(id)) continue;
    seenUnits.add(id);
    units++;
    checkUnit(bundle, unit, faction.name);
  }
  for (const stratagem of bundle.stratagems) {
    stratagems++;
    const where = `${faction.name}: ${stratagem.name}`;
    if (!stratagem.html.trim()) found("error", "stratagem with no text", where);
    else checkText("stratagem", stratagem.html, where);
    if (!stratagem.when.trim())
      found("error", "stratagem with no WHEN line (lists show nothing under its name)", where);
    if (!/^\d+$/.test(stratagem.cp.trim()))
      found("error", "stratagem cost that isn't a number", `${where} (${stratagem.cp})`);
    if (!PHASE.test(stratagem.phase))
      found(
        "error",
        "stratagem phase the phase filter can't place",
        `${where} ("${stratagem.phase}")`,
      );
    if (stratagem.turn && !TURN.test(stratagem.turn))
      found(
        "error",
        "stratagem turn the turn filter can't place",
        `${where} ("${stratagem.turn}")`,
      );
  }
  for (const detachment of bundle.detachments) {
    detachments++;
    const where = `${faction.name}: ${detachment.name}`;
    if (!detachment.rules.length) found("note", "detachment with no rule", where);
    for (const rule of detachment.rules) {
      if (!rule.html.trim())
        found("error", "detachment rule with no text", `${where} / ${rule.name}`);
      else checkText("detachment rule", rule.html, `${where} / ${rule.name}`);
    }
    for (const enhancement of detachment.enhancements) {
      const place = `${where} / ${enhancement.name}`;
      if (!enhancement.html.trim()) found("error", "enhancement with no text", place);
      else checkText("enhancement", enhancement.html, place);
      if (enhancement.cost && !/^\d+$/.test(enhancement.cost.trim()))
        found("error", "enhancement cost that isn't a number", `${place} (${enhancement.cost})`);
    }
  }
  for (const [key, rule] of Object.entries(bundle.rules)) {
    if (!rule.html.trim())
      found("error", "rule with no text", `${faction.name}: ${rule.name || key}`);
    else checkText("rule", rule.html, `${faction.name}: ${rule.name}`);
  }
}

report();

function checkUnit(bundle: FactionBundle, unit: UnitData, faction: string): void {
  const where = `${faction}: ${unit.name}`;
  const models = Object.values(unit.models);
  const lines = [...unit.stats, ...models.flatMap((model) => model.stats)];
  // BSData keeps some model types and wargear at the top level ("Loota", "Searchlight"); a list
  // never names them as units. Wahapedia knowing it as a datasheet says it's a real one.
  if (!unit.wahapedia && (!models.length || !lines.length || !unit.keywords.length)) {
    found(
      "note",
      "BSData entry that isn't a datasheet (a model or wargear kept at the top)",
      where,
    );
    return;
  }
  if (!models.length) found("error", "unit with no models", where);
  if (!lines.length) found("error", "unit with no stat line", where);
  for (const line of lines) {
    const blank = (["m", "t", "sv", "w", "ld", "oc"] as const).filter(
      (field) => !line[field].trim(),
    );
    if (blank.length)
      found(
        "error",
        "stat line with a blank characteristic",
        `${where} / ${line.name} (${blank.join(", ")})`,
      );
  }
  if (!unit.keywords.length) found("error", "unit with no keywords", where);
  if (!unit.factionKeywords.length) found("note", "unit with no faction keyword", where);
  if (!unit.wahapedia?.legend) found("note", "unit with no background text", where);
  const priced = unit.points.base > 0 || models.some((model) => model.cost > 0);
  if (!priced) found("note", "unit with no points", where);

  for (const ability of unit.abilities) checkAbility(ability, where);
  if (unit.attachTo && !unit.attachTo.html.trim())
    found("error", `empty ${unit.attachTo.title} box`, where);
  const items = new Map<string, ItemData>();
  for (const [key, item] of Object.entries(unit.items)) items.set(key, item);
  for (const model of models)
    for (const [key, item] of Object.entries(model.items)) items.set(key, item);
  for (const item of items.values()) {
    for (const ability of item.abilities) checkAbility(ability, `${where} / ${item.name}`);
    for (const weapon of [...item.ranged, ...item.melee]) {
      const blank = (["range", "attacks", "skill", "strength", "ap", "damage"] as const).filter(
        (field) => !weapon[field].trim(),
      );
      if (blank.length)
        found(
          "error",
          "weapon with a blank column",
          `${where} / ${weapon.name} (${blank.join(", ")})`,
        );
      for (const keyword of weapon.keywords) {
        if (!bundle.rules[ruleKey(keyword)])
          found(
            "note",
            "weapon keyword with no rule text (tapping it does nothing)",
            `${faction}: ${keyword}`,
          );
      }
    }
  }
  for (const name of [...unit.coreRules, ...unit.factionRules]) {
    if (!bundle.rules[ruleKey(name)])
      found(
        "note",
        "ability named on a card with no rule text (tapping it does nothing)",
        `${faction}: ${name}`,
      );
  }
}

function checkAbility(ability: { name: string; html: string }, where: string): void {
  const place = `${where} / ${ability.name}`;
  if (!ability.html.trim()) found("error", "ability with no text", place);
  else checkText("ability", ability.html, place);
  const [, type, name] = ability.name.match(/^(.+?): (.+)$/) ?? [];
  if (type && type === name) found("error", "ability label that repeats itself", place);
}

/** Markup that should have become formatting, or tags that shouldn't be there at all. */
function checkText(kind: string, html: string, where: string): void {
  if (/\*\*|\^\^/.test(html))
    found("error", `${kind} with BSData markup left in it (** or ^^)`, where);
  if (/&lt;\/?(?:b|i|br|p|ins|span|ul|li)\b/i.test(html))
    found("error", `${kind} with an escaped HTML tag showing`, where);
  if (/<(?!\/?(?:b|strong|i|em|u|br|p|ul|li|span)\b)[a-z]/i.test(html))
    found("error", `${kind} with an unexpected HTML tag`, where);
  if (/(<br>\s*){3,}/.test(html)) found("note", `${kind} with a run of blank lines`, where);
}

function found(severity: Severity, kind: string, where: string, detail = ""): void {
  const entry = findings.get(kind) ?? { severity, places: new Map<string, Set<string>>() };
  const place = detail ? `${where}: ${detail}` : where;
  entry.places.set(place, entry.places.get(place) ?? new Set());
  findings.set(kind, entry);
}

function report(): void {
  console.log(
    `${factions.length} factions: ${units} distinct units, ${stratagems} stratagems, ${detachments} detachments.\n`,
  );
  const sorted = [...findings].sort(([, a], [, b]) =>
    a.severity === b.severity ? b.places.size - a.places.size : a.severity === "error" ? -1 : 1,
  );
  let errors = 0;
  for (const [kind, { severity, places }] of sorted) {
    if (severity === "error") errors += places.size;
    console.log(`${severity === "error" ? "✗" : "·"} ${kind}: ${places.size}`);
    if (severity === "error" || showNotes) {
      const shown = showNotes ? [...places.keys()] : [...places.keys()].slice(0, EXAMPLES);
      for (const place of shown) console.log(`    ${place}`);
      if (places.size > shown.length) console.log(`    … and ${places.size - shown.length} more`);
    }
  }
  console.log(errors ? `\n${errors} errors.` : "\nNo errors.");
  if (errors) process.exitCode = 1;
}
