import { normalizeName } from "./bsdata/catalogues";
import type { FactionBundle, UnitData } from "./bundle";
import { stripArrow } from "./compile/faction";
import { stripTags } from "./markup";
import type { UnitOverride } from "./overrides";
import { price } from "./resolve/points";
import { emptyTally } from "./resolve/tally";
import { comparable, type Wahapedia } from "./wahapedia";

/**
 * Where our data (BSData frozen on 11 November 2026, with our overrides) and
 * Wahapedia today disagree, with the overrides that would bring ours in line.
 * Wahapedia is a second source, not the truth: each change is for a person to
 * check against the points list or dataslate it comes from.
 */
export type Finding = { what: string; ours: string; theirs: string };
export type UnitDrift = { unit: string; findings: Finding[]; proposal: UnitOverride };
export type FactionDrift = {
  faction: string;
  units: UnitDrift[];
  /** Enhancements BSData prices differently, by name: ours and Wahapedia's. */
  enhancements: (Finding & { name: string; cost: number })[];
  /** Units in our data that Wahapedia has no datasheet for. */
  unmatched: string[];
  /** Units priced by which models they have, whose points can't be compared by squad size. */
  unpriced: string[];
};

/** A datasheet's prices on Wahapedia: by squad size, for later copies, and per option. */
export type WahapediaCosts = {
  sizes: Record<number, number>;
  /** What a squad of each size costs once the army already has `after` of the datasheet. */
  repeat?: { after: number; sizes: Record<number, number> };
  options: Record<string, number>;
};

/**
 * Reads a datasheet's points lines: headings with no cost start a section
 * ("YOUR UNIT COSTS", "YOUR 1ST TO 2ND UNITS COST", "YOUR 3RD+ UNIT COSTS",
 * "WARGEAR OPTIONS"), then each priced line in it ("10 models", "per Multi-melta").
 * Sections for other armies (an Assigned Agent's) are skipped.
 */
export function parseCosts(lines: { description: string; cost: string }[]): WahapediaCosts {
  const costs: WahapediaCosts = { sizes: {}, options: {} };
  let section: "unit" | "repeat" | "options" | "other" = "unit";
  for (const { description, cost } of lines) {
    const text = stripTags(description).trim();
    if (!cost.trim()) {
      const later = /your (\d+)(?:st|nd|rd|th)\+/i.exec(text);
      if (/wargear options/i.test(text)) section = "options";
      else if (later) {
        section = "repeat";
        costs.repeat = { after: Number(later[1]) - 1, sizes: {} };
      } else if (/your (?:unit|1st|first)/i.test(text)) section = "unit";
      else section = "other";
      continue;
    }
    const value = Number.parseInt(cost, 10);
    if (Number.isNaN(value)) continue;
    const size = /^(\d+)\s+models?$/i.exec(text);
    const option = /^per\s+(.+)$/i.exec(text);
    if (section === "unit" && size) costs.sizes[Number(size[1])] = value;
    else if (section === "repeat" && size && costs.repeat)
      costs.repeat.sizes[Number(size[1])] = value;
    else if (section === "options" && option?.[1]) costs.options[option[1]] = value;
  }
  return costs;
}

/** What our data prices a squad of `size` at: the models it must have, the rest its usual model. */
export function ourPrice(unit: UnitData, size: number): number {
  const tally = emptyTally();
  let left = size;
  for (const [key, model] of Object.entries(unit.models)) {
    if (model.min <= 0 || left <= 0) continue;
    const count = Math.min(model.min, left);
    tally.models.set(key, count);
    left -= count;
  }
  const fill = unit.defaultModel ?? Object.keys(unit.models)[0];
  if (left > 0 && fill) tally.models.set(fill, (tally.models.get(fill) ?? 0) + left);
  tally.modelCount = size;
  let total = price(unit.points, tally);
  for (const [key, count] of tally.models) total += (unit.models[key]?.cost ?? 0) * count;
  return total;
}

/** Our labels for a stat or weapon field, as the cross-check writes them, to the override's keys. */
const STAT_FIELDS: Record<string, string> = {
  M: "m",
  T: "t",
  Sv: "sv",
  W: "w",
  Ld: "ld",
  OC: "oc",
  InSv: "invSv",
};
const WEAPON_FIELDS: Record<string, string> = {
  Range: "range",
  A: "attacks",
  "BS/WS": "skill",
  S: "strength",
  AP: "ap",
  D: "damage",
};

/** Wahapedia's value written our way: `12` as `12"` and `3` as `3+` where ours has them. */
function ourFormat(theirs: string, ours: string): string {
  if (/^\d+$/.test(theirs) && ours.endsWith('"')) return `${theirs}"`;
  if (/^\d+$/.test(theirs) && ours.endsWith("+")) return `${theirs}+`;
  return theirs;
}

export function factionDrift(bundle: FactionBundle, wahapedia: Wahapedia): FactionDrift {
  const units: UnitDrift[] = [];
  const unmatched: string[] = [];
  const unpriced: string[] = [];

  for (const unit of Object.values(bundle.units)) {
    const id = unit.wahapedia?.id;
    if (!id) {
      unmatched.push(unit.name);
      continue;
    }
    const findings: Finding[] = [];
    const proposal: UnitOverride = {};

    // Points by squad size, for later copies, and per option. A unit priced by which models
    // it has (a Kill Team, Inquisitorial Agents) has no one price for a size to compare.
    const costs = parseCosts(wahapedia.costs.get(id) ?? []);
    const bySize =
      Object.values(unit.models).every((model) => !model.cost) &&
      unit.points.rules.every((rule) => rule.when.every((count) => !count.models && !count.item));
    const sizes = Object.entries(costs.sizes).map(([size, cost]) => [Number(size), cost] as const);
    if (!bySize && sizes.length) unpriced.push(unit.name);
    const off = bySize ? sizes.filter(([size, cost]) => ourPrice(unit, size) !== cost) : [];
    for (const [size, cost] of off) {
      findings.push({
        what: `points for ${size} model${size === 1 ? "" : "s"}`,
        ours: String(ourPrice(unit, size)),
        theirs: String(cost),
      });
    }
    if (off.length) proposal.points = Object.fromEntries(sizes.map(([s, c]) => [String(s), c]));

    const [firstSize, firstCost] = sizes[0] ?? [];
    const laterCost = firstSize === undefined ? undefined : costs.repeat?.sizes[firstSize];
    const theirsRepeat =
      costs.repeat && firstCost !== undefined && laterCost !== undefined
        ? { after: costs.repeat.after, value: laterCost - firstCost }
        : undefined;
    const oursRepeat = unit.points.repeat;
    const describe = (r?: { after: number; value: number }) =>
      r?.value ? `+${r.value} from copy ${r.after + 1}` : "none";
    if (describe(oursRepeat) !== describe(theirsRepeat) && sizes.length) {
      findings.push({
        what: "later copies",
        ours: describe(oursRepeat),
        theirs: describe(theirsRepeat),
      });
      proposal.repeat = theirsRepeat?.value ? theirsRepeat : null;
    }

    for (const [name, cost] of Object.entries(costs.options)) {
      const key = normalizeName(name);
      if (!(key in unit.costs) && !(key in unit.items)) {
        findings.push({ what: `cost of ${name}`, ours: "no such option", theirs: String(cost) });
        continue;
      }
      const ours = unit.costs[key] ?? 0;
      if (ours !== cost) {
        findings.push({ what: `cost of ${name}`, ours: String(ours), theirs: String(cost) });
        proposal.costs = { ...proposal.costs, [name]: cost };
      }
    }

    // Stat lines and weapon numbers: the cross-check already compared them.
    for (const issue of unit.crossCheck) {
      const label = Object.keys({ ...STAT_FIELDS, ...WEAPON_FIELDS }).find((field) =>
        issue.field.endsWith(` ${field}`),
      );
      if (!label) continue;
      const name = issue.field.slice(0, -label.length - 1);
      const value = ourFormat(issue.wahapedia, issue.bsdata);
      findings.push({ what: `${name} ${label}`, ours: issue.bsdata, theirs: issue.wahapedia });
      const stat = STAT_FIELDS[label];
      const weapon = WEAPON_FIELDS[label];
      if (stat)
        proposal.stats = {
          ...proposal.stats,
          [name]: { ...proposal.stats?.[name], [stat]: value },
        };
      if (weapon) {
        proposal.weapons = {
          ...proposal.weapons,
          [name]: { ...proposal.weapons?.[name], [weapon]: value },
        };
      }
    }

    // Weapon keywords, which the cross-check leaves out.
    const profiles = [
      ...Object.values(unit.items),
      ...Object.values(unit.models).flatMap((model) => Object.values(model.items)),
    ].flatMap((item) => [
      ...item.ranged.map((p) => ({ p, type: "ranged" })),
      ...item.melee.map((p) => ({ p, type: "melee" })),
    ]);
    const checked = new Set<string>();
    for (const { p, type } of profiles) {
      if (checked.has(p.name)) continue;
      checked.add(p.name);
      const theirs = (wahapedia.wargear.get(id) ?? []).find(
        (w) =>
          w.type.toLowerCase() === type &&
          comparable(stripArrow(w.name)) === comparable(stripArrow(p.name)),
      );
      if (!theirs) continue;
      const wanted = splitKeywords(theirs.keywords);
      const have = new Map(p.keywords.map((k) => [comparable(k), k]));
      const same =
        wanted.length === have.size && wanted.every((keyword) => have.has(comparable(keyword)));
      if (same) continue;
      findings.push({
        what: `${p.name} keywords`,
        ours: p.keywords.join(", ") || "none",
        theirs: wanted.join(", ") || "none",
      });
      proposal.weapons = {
        ...proposal.weapons,
        [p.name]: {
          ...proposal.weapons?.[p.name],
          keywords: wanted.map((k) => have.get(comparable(k)) ?? titleCase(k)),
        },
      };
    }

    // Unit keywords. Names aren't compared: BSData gives a unit its own name as a keyword,
    // Wahapedia each model's ("Aestred Thurga", "Agathae Dolan").
    const names = new Set(
      [unit.name, ...Object.values(unit.models).map((m) => m.name)].map((n) => comparable(n)),
    );
    const ours = new Map(
      [
        ...unit.keywords,
        ...unit.factionKeywords,
        ...Object.values(unit.models).flatMap((m) => [...m.keywords, ...m.factionKeywords]),
      ].map((k) => [comparable(k), k]),
    );
    const theirsAll = wahapedia.keywords.get(id) ?? [];
    const theirs = theirsAll.map((k) => k.keyword);
    const theirsLower = new Set(theirs.map((k) => comparable(k)));
    const add = theirsAll
      .filter(
        (k) => !k.faction && !ours.has(comparable(k.keyword)) && !names.has(comparable(k.keyword)),
      )
      .map((k) => k.keyword);
    const remove = [...ours.values()].filter(
      (k) => !theirsLower.has(comparable(k)) && !names.has(comparable(k)),
    );
    if (theirs.length && (add.length || remove.length)) {
      findings.push({
        what: "keywords",
        ours: remove.length ? `also ${remove.join(", ")}` : "–",
        theirs: add.length ? `also ${add.join(", ")}` : "–",
      });
      proposal.keywords = {
        ...(add.length ? { add } : {}),
        ...(remove.length ? { remove } : {}),
      };
    }

    if (findings.length) units.push({ unit: unit.name, findings, proposal });
  }

  // Enhancements: BSData's own price on each character wins over the detachment's.
  const enhancements: FactionDrift["enhancements"] = [];
  const plain = (name: string) =>
    normalizeName(name)
      .replace(/\s*\([^)]*\)$/, "")
      .replace(/^the /, "");
  for (const enhancement of bundle.detachments.flatMap((d) => d.enhancements)) {
    const theirs = Number.parseInt(enhancement.cost, 10);
    if (Number.isNaN(theirs)) continue;
    const ours = Object.values(bundle.units)
      .flatMap((unit) => Object.entries(unit.costs))
      .find(([key]) => plain(key) === plain(enhancement.name))?.[1];
    if (
      ours !== undefined &&
      ours !== theirs &&
      !enhancements.some((e) => e.name === enhancement.name)
    ) {
      enhancements.push({
        name: enhancement.name,
        cost: theirs,
        what: `${enhancement.name} enhancement`,
        ours: String(ours),
        theirs: String(theirs),
      });
    }
  }

  return { faction: bundle.faction, units, enhancements, unmatched, unpriced };
}

/** "anti-psyker 4+, devastating wounds, pistol" as keywords, without markup. */
function splitKeywords(text: string): string[] {
  return stripTags(text)
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && k !== "-");
}

/** "anti-psyker 4+" as our data writes keywords: "Anti-Psyker 4+". */
function titleCase(keyword: string): string {
  return keyword.replace(
    /(^|[\s-])([a-z])/g,
    (_, before: string, letter: string) => before + letter.toUpperCase(),
  );
}

/**
 * Wahapedia's datasheets for a faction that none of the given bundles has:
 * new units, or ones our data names too differently to match.
 */
export function newOnWahapedia(bundles: FactionBundle[], wahapedia: Wahapedia): string[] {
  const factionIds = new Set(bundles.map((b) => b.wahapediaFactionId));
  const matched = new Set(
    bundles.flatMap((b) =>
      Object.values(b.units).flatMap((u) => (u.wahapedia ? [u.wahapedia.id] : [])),
    ),
  );
  return wahapedia.datasheets
    .filter((sheet) => factionIds.has(sheet.factionId) && !matched.has(sheet.id))
    .map((sheet) => sheet.name)
    .sort();
}
