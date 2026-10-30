import { normalizeName } from "../bsdata/catalogues";
import type { FactionBundle, ItemData, ModelData, UnitData, WeaponProfileData } from "../bundle";
import { applyModifier } from "../compile/faction";
import type { ListItem, ListUnit } from "../list/types";
import type { Datasheet, StatLine, WeaponRow } from "../types";
import { comparable } from "../wahapedia";
import { looseName, matchEnhancement, matchItem, matchModel, soleModel } from "./match";
import { unitPoints } from "./points";
import { addCount, emptyTally } from "./tally";

/** The GW app's own complaints, which can land among a unit's lines. */
const IGNORED_LINES = /^invalid wargear/i;

/**
 * Finds a list's unit in the bundle: exact name, then loosely (case, hyphens,
 * "[Legends]", plurals), then as the start of a longer name, for units BSData
 * renamed ("Custodian Guard" is "Custodian Guard Sodality").
 */
export function findUnit(bundle: FactionBundle, name: string): UnitData | undefined {
  const exact = bundle.units[normalizeName(name)];
  if (exact) return exact;
  const units = Object.values(bundle.units);
  const key = comparable(name);
  const loose = looseName(name);
  const found =
    units.find((unit) => comparable(unit.name) === key) ??
    units.find((unit) => looseName(unit.name) === loose) ??
    // Without its "Squad": "Vigilators" is the Vigilator Squad.
    units.find((unit) => looseName(unit.name) === `${loose} squad`);
  // Only a renamed unit gets the prefix rule: two words or more, one word added.
  if (found || key.split(" ").length < 2) return found;
  const legends = /legends/i.test(name);
  return units
    .filter((unit) => {
      const theirs = comparable(unit.name);
      return theirs.startsWith(`${key} `) && !theirs.slice(key.length + 1).includes(" ");
    })
    .filter((unit) => legends || !/legends/i.test(unit.name))
    .sort((a, b) => a.name.length - b.name.length)[0];
}

/**
 * One unit's card: only the weapons and wargear the list took, with how many
 * models carry each, and any changes those selections make to the profiles.
 * Also what the unit costs.
 * `copiesBefore` counts the same datasheet earlier in the army, which can cost more.
 */
export function resolveDatasheet(
  bundle: FactionBundle,
  unit: ListUnit,
  id: string,
  copiesBefore = 0,
): Datasheet {
  const sheet: Datasheet = {
    id,
    name: unit.name,
    points: unit.points,
    listedPoints: unit.points,
    pointsExact: false,
    models: [],
    modelCount: 0,
    stats: [],
    ranged: [],
    melee: [],
    coreAbilities: [],
    factionAbilities: [],
    abilities: [],
    wargearAbilities: [],
    isWarlord: unit.isWarlord,
    keywords: [],
    factionKeywords: [],
    attachment: unit.attachment,
    warnings: [],
  };

  const data = findUnit(bundle, unit.name);
  if (!data) {
    sheet.warnings.push(`BSData has no unit named "${unit.name}".`);
    return sheet;
  }

  sheet.stats = data.stats.map((line) => ({ ...line }));
  sheet.abilities = [...data.abilities];
  sheet.attachTo = data.attachTo;
  sheet.coreAbilities = [...data.coreRules];
  sheet.factionAbilities = [...data.factionRules];
  sheet.keywords = [...data.keywords];
  sheet.factionKeywords = [...data.factionKeywords];
  sheet.wahapediaId = data.wahapedia?.id;
  sheet.legend = data.wahapedia?.legend || undefined;

  const rows = new Map<string, WeaponRow>();
  const selected = new Set<string>();
  // Who carries each weapon row: the list's model groups, with their BSData models.
  const groups: Carrier[] = [];
  const carriers = new Map<WeaponRow, Map<Carrier | undefined, number>>();
  // A combined option the list names part by part ("Particle caster", "Voidblade") counts once per group.
  const countedParts = new Set<string>();
  // The options each carrier lists, by carrier and option key.
  const listed = new Set<string>();
  const tally = emptyTally();

  const addModel = (name: string, count: number, items: ListItem[]) => {
    const match =
      matchModel(
        data,
        name,
        items.map((item) => item.name),
      ) ?? soleModel(data);
    const model = match?.model;
    selected.add(normalizeName(name));
    if (match) {
      selected.add(match.key);
      addCount(tally.models, match.key, count);
    }
    if (!model) {
      sheet.warnings.push(`BSData has no model named "${name}" in ${sheet.name}.`);
    } else {
      for (const line of model.stats) pushStats(sheet.stats, { ...line });
      for (const keyword of model.keywords) {
        if (!sheet.keywords.includes(keyword)) sheet.keywords.push(keyword);
      }
      for (const keyword of model.factionKeywords) {
        if (!sheet.factionKeywords.includes(keyword)) sheet.factionKeywords.push(keyword);
      }
    }
    sheet.models.push({ name, count });
    const carrier: Carrier = { name, count, model };
    groups.push(carrier);
    for (const item of items) addItem(item, model?.items, carrier);
  };

  const addItem = (item: ListItem, scope?: Record<string, ItemData>, carrier?: Carrier) => {
    selected.add(normalizeName(item.name));
    const match = matchItem([scope, data.items], item.name, data.aliases);
    if (!match) {
      if (!IGNORED_LINES.test(item.name)) {
        sheet.warnings.push(`BSData has no wargear named "${item.name}" in ${sheet.name}.`);
      }
      return;
    }
    selected.add(match.key);
    const found = match.item;
    let count = item.count;
    if (match.part) {
      const part = `${carrier?.name ?? "unit"}:${match.key}`;
      if (countedParts.has(part)) count = 0;
      countedParts.add(part);
    }
    // Wargear listed at the unit's level (the flat export) belongs to whichever
    // listed model is the only one BSData lets take it, if there's just one.
    const key = match.key.split(":")[0] ?? match.key;
    const owners = carrier ? [carrier] : groups.filter((g) => g.model?.items[key]);
    const owner = owners.length === 1 ? owners[0] : undefined;
    // The official app can list an option and then the weapon inside it ("Psychic Gifts",
    // then "Psychic Shock Wave"): that weapon is the option's own, already counted.
    const listedBy = `${carrier?.name ?? "unit"}:`;
    if (match.key.includes(":") && listed.has(listedBy + key)) return;
    listed.add(listedBy + match.key);
    addCount(tally.items, key, count);
    for (const [profiles, melee] of [
      [found.ranged, false],
      [found.melee, true],
    ] as const) {
      if (!profiles.length) continue;
      const row = addWeapon(
        rows,
        melee ? sheet.melee : sheet.ranged,
        found,
        profiles,
        count,
        melee,
      );
      const byCarrier = carriers.get(row) ?? new Map<Carrier | undefined, number>();
      byCarrier.set(owner, (byCarrier.get(owner) ?? 0) + count);
      carriers.set(row, byCarrier);
    }
    for (const ability of found.abilities) {
      if (!sheet.wargearAbilities.some((a) => a.name === ability.name))
        sheet.wargearAbilities.push(ability);
    }
  };

  for (const group of unit.groups) addModel(group.name, group.count, group.items);
  // A top-level line with nothing under it is either a model or the unit's own gear:
  // an exact option name wins, then a model name, then a loose option name.
  // Models first, so the gear can be traced to the model that carries it.
  const gear: ListItem[] = [];
  for (const item of unit.items) {
    const asItem = matchItem([data.items], item.name, data.aliases);
    const asModel = asItem?.exact ? undefined : matchModel(data, item.name);
    if (asModel) addModel(item.name, item.count, []);
    else gear.push(item);
  }
  for (const item of gear) addItem(item);

  if (sheet.models.length === 0) {
    sheet.models.push({ name: data.name, count: 1 });
    // For points: the models it must have, or else one of its default model.
    for (const [key, model] of Object.entries(data.models)) {
      if (model.min > 0) addCount(tally.models, key, model.min);
    }
    if (!tally.models.size && data.defaultModel) addCount(tally.models, data.defaultModel, 1);
  }
  // A squad listed by its wargear alone still needs its models' stat line: the
  // one they share, or each model it must have plus its trooper.
  if (sheet.stats.length === 0) {
    const shared = soleModel(data)?.model;
    const models = shared
      ? [shared]
      : Object.entries(data.models)
          .filter(([key, model]) => model.min > 0 || key === data.defaultModel)
          .map(([, model]) => model);
    for (const model of models) for (const line of model.stats) pushStats(sheet.stats, { ...line });
  }
  sheet.modelCount = sheet.models.reduce((sum, model) => sum + model.count, 0);
  if (sheet.stats.length === 0) sheet.warnings.push(`No stat line found for "${unit.name}".`);

  // A weapon only the squad's leader carries (its Superior, Sergeant, Nob) says so.
  for (const [row, byCarrier] of carriers) {
    const holders = [...byCarrier].filter(([, count]) => count > 0);
    const [only] = holders;
    const leader = holders.length === 1 ? only?.[0] : undefined;
    if (leader && isSquadLeader(leader, sheet.modelCount)) {
      row.carrier = modelLabel(leader.name, unit.name);
    }
  }

  if (unit.enhancement) {
    selected.add(normalizeName(unit.enhancement));
    const ability = matchEnhancement(bundle, data, unit.enhancement);
    if (ability) {
      selected.add(normalizeName(ability.name));
      sheet.enhancement = ability;
    } else {
      sheet.warnings.push(
        `BSData has no enhancement named "${unit.enhancement}" for ${sheet.name}.`,
      );
      sheet.enhancement = { name: unit.enhancement, html: "" };
    }
  }

  // Changes the list's selections make to profiles, e.g. an upgrade's extra keyword.
  for (const modifier of data.modifiers) {
    if (!selected.has(modifier.when)) continue;
    for (const row of [...sheet.ranged, ...sheet.melee]) {
      for (const profile of row.profiles) {
        if (profile.name === modifier.profile) {
          applyModifier(profile, modifier.field, modifier.op, modifier.value);
        }
      }
    }
    for (const line of sheet.stats) {
      if (line.name === modifier.profile)
        applyModifier(line, modifier.field, modifier.op, modifier.value);
    }
  }

  tally.modelCount = sheet.modelCount;
  sheet.points = unitPoints(bundle, data, tally, sheet.enhancement?.name, copiesBefore);
  sheet.pointsExact = data.points.exact;
  // A squad that lists an unknown item on two lines says so once.
  sheet.warnings = [...new Set(sheet.warnings)];

  return sheet;
}

/** One of the list's model groups: "1x Celestian Insidiant Superior" and the BSData model it is. */
type Carrier = { name: string; count: number; model?: ModelData };

/** The one-per-squad model in a squad of several: a Superior, Sergeant, Exarch, Nob. */
function isSquadLeader(carrier: Carrier, modelCount: number): boolean {
  return (
    modelCount > 1 &&
    carrier.count === 1 &&
    carrier.model !== undefined &&
    carrier.model.min === 1 &&
    carrier.model.max === 1
  );
}

/**
 * A model's name without the words it shares with its unit's:
 * "Celestian Insidiant Superior" in Celestian Insidiants is "Superior".
 */
export function modelLabel(model: string, unit: string): string {
  const unitWords = new Set(unit.split(/\s+/).map((word) => looseName(word)));
  const words = model.split(/\s+/);
  let start = 0;
  while (start < words.length - 1 && unitWords.has(looseName(words[start] ?? ""))) start++;
  return words.slice(start).join(" ");
}

function addWeapon(
  rows: Map<string, WeaponRow>,
  list: WeaponRow[],
  item: ItemData,
  profiles: WeaponProfileData[],
  count: number,
  melee: boolean,
): WeaponRow {
  const key = `${melee ? "melee" : "ranged"}:${normalizeName(item.name)}`;
  let row = rows.get(key);
  if (!row) {
    // Several profiles on one option: name the row after the option, like the official cards.
    const name = profiles.length > 1 ? item.name : profiles[0]?.name;
    row = {
      name: name ?? item.name,
      count: 0,
      profiles: profiles.map((p) => ({ ...p, keywords: [...p.keywords] })),
    };
    rows.set(key, row);
    list.push(row);
  }
  row.count += count;
  return row;
}

function pushStats(list: StatLine[], line: StatLine): void {
  const same = list.some(
    (s) =>
      s.m === line.m &&
      s.t === line.t &&
      s.sv === line.sv &&
      s.w === line.w &&
      s.ld === line.ld &&
      s.oc === line.oc &&
      s.invSv === line.invSv,
  );
  if (!same) list.push(line);
}
