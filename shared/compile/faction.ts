import {
  type BsCondition,
  type BsModifier,
  type BsNode,
  type Catalogues,
  normalizeName,
  SKIPPED_GROUPS,
} from "../bsdata/catalogues";
import {
  COMPILER_VERSION,
  type Counted,
  type FactionBundle,
  factionBundleSchema,
  type ItemData,
  type ModelData,
  type ModifierData,
  type ModifierOp,
  type PointsCount,
  type PointsData,
  type ProfileField,
  ruleKey,
  type StratagemData,
  type UnitData,
  type WeaponProfileData,
} from "../bundle";
import { findFaction as findKnownFaction } from "../factions";
import { bsdataToHtml, sanitizeWahapediaHtml, stripTags } from "../markup";
import { isCoreStratagem, latestByName, whenLine } from "../stratagems";
import type { Ability, CrossCheckIssue, StatLine } from "../types";
import { comparable, findDatasheet, findFaction, type Wahapedia } from "../wahapedia";

const NOT_KEYWORDS = new Set(["warlord", "configuration"]);
const FACTION_PREFIX = /^Faction: /;

const WEAPON_FIELDS: Record<string, ProfileField> = {
  Range: "range",
  A: "attacks",
  BS: "skill",
  WS: "skill",
  S: "strength",
  AP: "ap",
  D: "damage",
  Keywords: "keywords",
};
const UNIT_FIELDS: Record<string, ProfileField> = {
  M: "m",
  T: "t",
  Sv: "sv",
  W: "w",
  LD: "ld",
  OC: "oc",
  InSv: "invSv",
};

export type CompileStats = { units: number; modifiersApplied: number; modifiersSkipped: number };

/**
 * Compiles one faction: its catalogue and linked libraries from BSData, and
 * its detachments, stratagems and datasheet links from Wahapedia, into a
 * bundle the browser can build armies from.
 */
export function compileFaction(input: {
  faction: string;
  catalogue: string;
  catalogues: Catalogues;
  wahapedia: Wahapedia;
  bsdataSha: string;
}): { bundle: FactionBundle; stats: CompileStats } {
  const { catalogues, wahapedia } = input;
  const stats: CompileStats = { units: 0, modifiersApplied: 0, modifiersSkipped: 0 };
  // Wahapedia's own name for the faction (every chapter is Space Marines there),
  // then the list's faction line, then the catalogue's name.
  const known = findKnownFaction(input.faction) ?? findKnownFaction(input.catalogue);
  const factionId = (
    (known?.wahapedia ? findFaction(wahapedia, known.wahapedia) : undefined) ??
    findFaction(wahapedia, input.faction) ??
    findFaction(wahapedia, input.catalogue.replace(/^.* - /, ""))
  )?.id;

  const detachments = wahapedia.detachments.filter(
    (d) => d.factionId === factionId && d.type !== "Boarding Actions",
  );
  const detachmentIds = new Set(detachments.map((d) => d.id));
  const stratagems: StratagemData[] = [
    ...wahapedia.stratagems.filter((s) => detachmentIds.has(s.detachmentId)),
    ...latestByName(wahapedia.stratagems.filter(isCoreStratagem)),
  ].map((s) => ({
    id: s.id,
    name: s.name,
    cp: s.cp,
    type: s.type,
    phase: s.phase,
    turn: s.turn,
    detachment: s.detachment,
    detachmentId: s.detachmentId,
    html: sanitizeWahapediaHtml(s.description),
    when: whenLine(s.description),
    targetsUnits: wahapedia.unitStratagems.has(s.id),
  }));
  const stratagemIds = new Set(stratagems.map((s) => s.id));

  const compiler = new UnitCompiler(catalogues, stats);
  const units: Record<string, UnitData> = {};
  for (const root of catalogues.rootEntries()) {
    const key = normalizeName(root.name);
    if (!root.name || units[key]) continue;
    const unit = compiler.compile(root);

    const sheet = findDatasheet(wahapedia, unit.name, factionId);
    if (sheet) {
      unit.wahapedia = {
        id: sheet.id,
        legend: stripTags(sheet.legend),
        stratagemIds: [...(wahapedia.datasheetStratagems.get(sheet.id) ?? [])].filter((id) =>
          stratagemIds.has(id),
        ),
      };
      unit.crossCheck = crossCheckUnit(wahapedia, sheet.id, unit);
    }
    units[key] = unit;
    stats.units++;
  }

  const bundle = factionBundleSchema.parse({
    compilerVersion: COMPILER_VERSION,
    faction: input.faction,
    catalogue: input.catalogue,
    wahapediaFactionId: factionId,
    sources: { bsdataSha: input.bsdataSha, wahapediaUpdate: wahapedia.lastUpdate },
    units,
    detachments: detachments.map((d) => ({
      id: d.id,
      name: d.name,
      rules: wahapedia.detachmentRules
        .filter((rule) => rule.detachmentId === d.id)
        .map((rule) => ({ name: rule.name, html: sanitizeWahapediaHtml(rule.description) })),
      enhancements: wahapedia.enhancements
        .filter((e) => e.detachmentId === d.id)
        .map((e) => ({ name: e.name, cost: e.cost, html: sanitizeWahapediaHtml(e.description) })),
    })),
    stratagems,
    rules: compileRules(catalogues, wahapedia, factionId),
  });
  return { bundle, stats };
}

class UnitCompiler {
  constructor(
    private readonly catalogues: Catalogues,
    private readonly stats: CompileStats,
  ) {}

  compile(root: BsNode): UnitData {
    const context = this.contextOf(root);
    const unit: UnitData = {
      name: root.name ?? "",
      stats: [],
      abilities: [],
      coreRules: [],
      factionRules: [],
      keywords: [],
      factionKeywords: [],
      models: {},
      items: {},
      modifiers: [],
      crossCheck: [],
      points: this.points(root),
      costs: {},
    };

    for (const profile of this.catalogues.profiles(root)) {
      if (profile.typeName === "Unit") {
        pushStats(unit.stats, this.statLine(profile, context, unit.modifiers));
      } else if (
        profile.typeName === "Abilities" &&
        (profile.name === "Leader" || profile.name === "Support")
      ) {
        unit.attachTo = { title: profile.name, html: bsdataToHtml(description(profile)) };
      } else if (profile.typeName && !isWeapon(profile)) {
        pushAbility(unit.abilities, profile);
      }
    }
    for (const rule of this.catalogues.rules(root)) {
      const list = rule.core ? unit.coreRules : unit.factionRules;
      if (!list.includes(rule.name)) list.push(rule.name);
    }
    addCategories(this.catalogues.categories(root), unit);

    // A single-model unit is its own model, and its points are the unit's.
    if (root.type === "model") {
      const model = this.model(root, context, unit.modifiers);
      unit.models[normalizeName(root.name)] = { ...model, min: 1, max: 1, cost: 0 };
      for (const [key, item] of Object.entries(model.items)) unit.items[key] ??= item;
    }
    for (const node of this.descendants(root)) {
      const key = normalizeName(node.name);
      if (node.type === "model") {
        unit.models[key] ??= this.model(node, context, unit.modifiers);
        continue;
      }
      if (!unit.items[key]) {
        const item = this.item(node, context, unit.modifiers);
        if (item) unit.items[key] = item;
      }
      const cost = this.catalogues.points(node);
      if (!cost) continue;
      unit.costs[key] ??= cost;
      // A costed option of one weapon ("2x Inferno Pistols") prices each of its parts,
      // which is how most lists name it.
      const parts = this.parts(node);
      const [part] = parts;
      if (parts.length === 1 && part && normalizeName(part.name) !== key) {
        unit.costs[normalizeName(part.name)] ??= cost / part.count;
      }
    }
    // The unit's index covers its models' own options too, such as a weapon drawn on a model.
    for (const model of Object.values(unit.models)) {
      for (const [key, item] of Object.entries(model.items)) unit.items[key] ??= item;
    }
    unit.defaultModel = this.defaultModel(root, unit);
    return unit;
  }

  /**
   * A unit's points: its cost, and the modifiers on it that BSData keys to
   * squad size (or to an option taken). A modifier that only depends on which
   * army the unit is in ("not in an Agents army") is decided here, for this
   * faction; one that needs anything else makes the result inexact.
   */
  private points(root: BsNode): PointsData {
    const type = this.catalogues.pointsType;
    const points: PointsData = { base: this.catalogues.points(root), rules: [], exact: true };
    for (const modifier of root.modifiers ?? []) {
      if (modifier.field !== type) continue;
      const op = modifier.type;
      const value = Number(modifier.value);
      if (!isPointsOp(op) || !Number.isFinite(value)) {
        points.exact = false;
        continue;
      }
      // "A copy costs more once N of this datasheet come before it": counted over the army.
      const after = op === "increment" ? copiesBefore(modifier, root) : undefined;
      if (after !== undefined) {
        points.repeat = { after, value };
        continue;
      }
      const when = this.pointsCounts(modifier, root);
      if (when === "never") continue;
      if (when === "unknown") points.exact = false;
      else points.rules.push({ op, value, when });
    }
    return points;
  }

  private pointsCounts(modifier: BsModifier, root: BsNode): PointsCount[] | "never" | "unknown" {
    const conditions = [...(modifier.conditions ?? [])];
    for (const group of (modifier.conditionGroups ?? []) as BsConditionGroup[]) {
      const single = (group.conditions?.length ?? 0) === 1;
      if (group.conditionGroups?.length || group.localConditionGroups?.length) return "unknown";
      if (group.type !== "and" && !single) return "unknown";
      conditions.push(...(group.conditions ?? []));
    }
    const counts: PointsCount[] = [];
    for (const condition of conditions) {
      const read = this.pointsCount(condition, root);
      if (read === "always") continue;
      if (read === "never" || read === "unknown") return read;
      counts.push(read);
    }
    return counts;
  }

  private pointsCount(
    condition: BsCondition,
    root: BsNode,
  ): PointsCount | "always" | "never" | "unknown" {
    const { type, scope, childId } = condition;
    if ((type === "instanceOf" || type === "notInstanceOf") && scope === "primary-catalogue") {
      const inThisFaction = childId === this.catalogues.faction?.root.id;
      return (type === "instanceOf") === inThisFaction ? "always" : "never";
    }
    const own = scope === root.id || scope === "self" || scope === "unit-self";
    if (condition.field !== "selections" || !own || !isCompare(type)) return "unknown";
    const value = Number(condition.value);
    if (childId === "model") return { compare: type, value };
    const child = this.catalogues.lookup(childId)?.node;
    if (!child?.name) return "unknown";
    if (child.type === "model")
      return { compare: type, value, models: [normalizeName(child.name)] };
    // A group of the unit's models ("Terminators"): the models in it, counted together.
    const models = this.modelsIn(child);
    if (models.length) return { compare: type, value, models };
    return { compare: type, value, item: normalizeName(child.name) };
  }

  /** The model types anywhere inside a group, by normalized name. */
  private modelsIn(group: BsNode): string[] {
    const out = new Set<string>();
    const queue = [group];
    while (queue.length) {
      const node = queue.shift();
      if (!node) continue;
      for (const option of [...(node.selectionEntries ?? []), ...(node.entryLinks ?? [])]) {
        const entry = this.catalogues.resolve(option);
        if (entry.type === "model") out.add(normalizeName(entry.name));
      }
      queue.push(...this.groupsOf(node));
    }
    return [...out];
  }

  /** A node's choice groups, its own and the ones it links to. */
  private groupsOf(node: BsNode): BsNode[] {
    return [
      ...(node.selectionEntryGroups ?? []),
      ...(node.entryLinks ?? [])
        .filter((link) => link.type === "selectionEntryGroup")
        .map((link) => this.catalogues.resolve(link)),
    ];
  }

  /**
   * What an option is made of: itself when it's a weapon or wargear, else
   * its parts ("2x Inferno Pistols" is 2× Inferno Pistol).
   */
  private parts(entry: BsNode): Counted[] {
    const own = this.catalogues
      .profiles(entry)
      .some((profile) => isWeapon(profile) || profile.typeName === "Abilities");
    if (!own) {
      const parts: Counted[] = [];
      for (const child of this.catalogues.children(entry)) {
        const min = limit(child, "min");
        if (child.type === "model" || min <= 0) continue;
        for (const part of this.parts(child)) addCounted(parts, part.name, part.count * min);
      }
      if (parts.length) return parts;
    }
    return [{ name: entry.name ?? "", count: 1 }];
  }

  private model(node: BsNode, context: Set<string>, modifiers: ModifierData[]): ModelData {
    const model: ModelData = {
      name: node.name ?? "",
      stats: [],
      keywords: [],
      factionKeywords: [],
      items: {},
      min: limit(node, "min"),
      max: limit(node, "max"),
      defaults: this.defaults(node),
      cost: this.catalogues.points(node),
    };
    for (const profile of this.catalogues.profiles(node)) {
      if (profile.typeName === "Unit") {
        pushStats(model.stats, this.statLine(profile, context, modifiers));
      } else if (isWeapon(profile) && profile.name) {
        // A weapon drawn on the model itself, with no option to pick it.
        const item = model.items[normalizeName(profile.name)] ?? {
          name: profile.name,
          ranged: [],
          melee: [],
          abilities: [],
        };
        const weapon = this.weapon(profile, context, modifiers);
        (profile.typeName === "Ranged Weapons" ? item.ranged : item.melee).push(weapon);
        model.items[normalizeName(profile.name)] = item;
      }
    }
    addCategories(this.catalogues.categories(node), model);
    for (const child of this.descendants(node)) {
      const key = normalizeName(child.name);
      if (child.type === "model" || model.items[key]) continue;
      const item = this.item(child, context, modifiers);
      if (item) model.items[key] = item;
    }
    return model;
  }

  /**
   * What one model carries when a list doesn't say: weapons drawn on it,
   * options it must take (`min` per parent), and each required choice's default.
   */
  private defaults(node: BsNode): { name: string; count: number }[] {
    const out: { name: string; count: number }[] = [];
    const add = (name: string | undefined, count: number) => {
      if (!name || count <= 0) return;
      const existing = out.find((d) => d.name === name);
      if (existing) existing.count += count;
      else out.push({ name, count });
    };
    const isModel = (entry: BsNode) => entry.type === "model" || entry.type === "unit";

    const visitGroup = (group: BsNode) => {
      if (SKIPPED_GROUPS.test(group.name ?? "") || /enhancement/i.test(group.name ?? "")) return;
      const options = [...(group.selectionEntries ?? []), ...(group.entryLinks ?? [])];
      const min = limit(group, "min");
      const chosen =
        min > 0
          ? (options.find(
              (o) =>
                o.id === group.defaultSelectionEntryId ||
                o.targetId === group.defaultSelectionEntryId,
            ) ?? options[0])
          : undefined;
      if (chosen) {
        const entry = this.catalogues.resolve(chosen);
        if (chosen.type === "selectionEntryGroup") visitGroup(entry);
        else if (!isModel(entry)) add(entry.name, min);
      }
      visit(group, chosen);
    };
    const visit = (parent: BsNode, skip?: BsNode) => {
      for (const option of [...(parent.selectionEntries ?? []), ...(parent.entryLinks ?? [])]) {
        if (option === skip) continue;
        const entry = this.catalogues.resolve(option);
        if (option.type === "selectionEntryGroup") visitGroup(entry);
        else if (!isModel(entry)) add(entry.name, limit(entry, "min"));
      }
      for (const group of parent.selectionEntryGroups ?? []) visitGroup(group);
    };

    for (const profile of this.catalogues.profiles(node)) {
      if (isWeapon(profile)) add(profile.name, 1);
    }
    visit(node);
    return out.filter((d) => !/^warlord$/i.test(d.name));
  }

  /**
   * The model that makes up a squad's numbers: the one it may have most of
   * (the trooper, not the sergeant), its choice group's default on a tie
   * (Scouts with boltguns over Scouts with shotguns).
   */
  private defaultModel(root: BsNode, unit: UnitData): string | undefined {
    const most = Math.max(0, ...Object.values(unit.models).map((m) => m.max));
    const candidates = Object.keys(unit.models).filter((key) => unit.models[key]?.max === most);
    const defaults = new Set<string>();
    const groups = [...(root.selectionEntryGroups ?? [])];
    for (const link of root.entryLinks ?? []) {
      if (link.type === "selectionEntryGroup") groups.push(this.catalogues.resolve(link));
    }
    while (groups.length) {
      const group = groups.shift();
      if (!group) continue;
      const chosen = [...(group.selectionEntries ?? []), ...(group.entryLinks ?? [])].find(
        (o) =>
          o.id === group.defaultSelectionEntryId || o.targetId === group.defaultSelectionEntryId,
      );
      if (chosen) defaults.add(normalizeName(this.catalogues.resolve(chosen).name));
      groups.push(...(group.selectionEntryGroups ?? []));
    }
    return candidates.find((key) => defaults.has(key)) ?? candidates[0];
  }

  /** A weapon, piece of wargear or enhancement; combined options take their parts' profiles. */
  private item(
    node: BsNode,
    context: Set<string>,
    modifiers: ModifierData[],
  ): ItemData | undefined {
    let profiles = this.catalogues.profiles(node);
    if (!profiles.some((p) => isWeapon(p) || p.typeName === "Abilities")) {
      profiles = this.catalogues.children(node).flatMap((child) => this.catalogues.profiles(child));
    }
    const item: ItemData = { name: node.name ?? "", ranged: [], melee: [], abilities: [] };
    for (const profile of profiles) {
      if (profile.typeName === "Ranged Weapons") {
        item.ranged.push(this.weapon(profile, context, modifiers));
      } else if (profile.typeName === "Melee Weapons") {
        item.melee.push(this.weapon(profile, context, modifiers));
      } else if (profile.typeName) {
        pushAbility(item.abilities, profile);
      }
    }
    return item;
  }

  private weapon(
    profile: BsNode,
    context: Set<string>,
    modifiers: ModifierData[],
  ): WeaponProfileData {
    const keywords = characteristic(profile, "Keywords");
    const weapon: WeaponProfileData = {
      name: profile.name ?? "",
      range: characteristic(profile, "Range"),
      attacks: characteristic(profile, "A"),
      skill: characteristic(profile, "BS") || characteristic(profile, "WS"),
      strength: characteristic(profile, "S"),
      ap: characteristic(profile, "AP"),
      damage: characteristic(profile, "D"),
      keywords: splitKeywords(keywords),
    };
    this.applyModifiers(profile, WEAPON_FIELDS, weapon, context, modifiers);
    return weapon;
  }

  private statLine(profile: BsNode, context: Set<string>, modifiers: ModifierData[]): StatLine {
    const line: StatLine = {
      name: profile.name ?? "",
      m: characteristic(profile, "M"),
      t: characteristic(profile, "T"),
      sv: characteristic(profile, "Sv"),
      w: characteristic(profile, "W"),
      ld: characteristic(profile, "LD"),
      oc: characteristic(profile, "OC"),
      invSv: characteristic(profile, "InSv") || undefined,
    };
    this.applyModifiers(profile, UNIT_FIELDS, line, context, modifiers);
    return line;
  }

  /**
   * Applies a profile's modifiers that hold for this unit whatever the list
   * takes, and records the ones that depend on a selection in the list.
   * Modifiers with condition groups or army-wide conditions are skipped.
   */
  private applyModifiers(
    profile: BsNode,
    fields: Record<string, ProfileField>,
    target: Partial<Record<ProfileField, string | string[]>>,
    context: Set<string>,
    modifiers: ModifierData[],
  ): void {
    for (const modifier of profile.modifiers ?? []) {
      const characteristic = this.catalogues.characteristic(modifier.field);
      const field = characteristic ? fields[characteristic.name] : undefined;
      const op = modifier.type as ModifierOp;
      if (!field || !["set", "append", "increment", "decrement"].includes(op)) continue;
      // Appending to a number ("A+0") is Crusade bookkeeping that changes nothing.
      if (op === "append" && field !== "keywords") continue;

      const when = this.condition(modifier, context);
      if (when === "skip") {
        this.stats.modifiersSkipped++;
      } else if (when === "always") {
        applyModifier(target, field, op, String(modifier.value ?? ""));
        this.stats.modifiersApplied++;
      } else if (when !== "never") {
        const recorded: ModifierData = {
          when,
          profile: profile.name ?? "",
          field,
          op,
          value: String(modifier.value ?? ""),
        };
        // A profile reached from both the unit and a model shows up twice; an
        // increment recorded twice would apply twice.
        if (!modifiers.some((m) => JSON.stringify(m) === JSON.stringify(recorded))) {
          modifiers.push(recorded);
        }
      }
    }
  }

  /**
   * "always" or "never" when the unit alone decides it; a selection's
   * normalized name when the list does; "skip" when it's beyond this compiler.
   */
  private condition(modifier: BsModifier, context: Set<string>): string {
    if (modifier.conditionGroups?.length) return "skip";
    let selection: string | undefined;
    for (const condition of modifier.conditions ?? []) {
      if (condition.type === "instanceOf" || condition.type === "notInstanceOf") {
        const holds = context.has(condition.childId ?? "");
        if (holds !== (condition.type === "instanceOf")) return "never";
        continue;
      }
      const presence =
        (condition.type === "atLeast" && Number(condition.value) === 1) ||
        (condition.type === "greaterThan" && Number(condition.value) === 0);
      const local = ["self", "parent", "unit", "model"].includes(condition.scope ?? "");
      const name = this.catalogues.lookup(condition.childId)?.node.name;
      if (condition.field !== "selections" || !presence || !local || !name || selection)
        return "skip";
      selection = normalizeName(name);
    }
    return selection ?? "always";
  }

  /** The ids an `instanceOf` condition can name for this unit: the entry and its categories. */
  private contextOf(root: BsNode): Set<string> {
    const ids = new Set<string>();
    if (root.id) ids.add(root.id);
    for (const link of root.categoryLinks ?? []) if (link.targetId) ids.add(link.targetId);
    return ids;
  }

  /** Every entry below a node, breadth first. */
  private descendants(root: BsNode): BsNode[] {
    const out: BsNode[] = [];
    const queue = this.catalogues.children(root);
    while (queue.length) {
      const node = queue.shift();
      if (!node) continue;
      out.push(node);
      queue.push(...this.catalogues.children(node));
    }
    return out;
  }
}

type BsConditionGroup = {
  type?: string;
  value?: number;
  conditions?: BsCondition[];
  conditionGroups?: unknown[];
  localConditionGroups?: BsConditionGroup[];
};

/**
 * New Recruit's repeat surcharge: a count, over the army, of selections that
 * come before this one and are the same datasheet. Returns how many there
 * must be for the surcharge to apply, if the modifier is that.
 */
function copiesBefore(modifier: BsModifier, root: BsNode): number | undefined {
  const groups = (modifier.conditionGroups ?? []) as BsConditionGroup[];
  const local = groups.flatMap((group) => group.localConditionGroups ?? []);
  const [count] = local;
  if (local.length !== 1 || !count || modifier.conditions?.length) return undefined;
  const before = count.conditions?.some((c) => c.type === "before");
  const same = count.conditions?.some((c) => c.type === "instanceOf" && c.childId === root.id);
  return before && same ? Number(count.value ?? 0) : undefined;
}

function isPointsOp(op: string | undefined): op is PointsData["rules"][number]["op"] {
  return op === "set" || op === "increment" || op === "decrement" || op === "multiply";
}

function isCompare(type: string | undefined): type is PointsCount["compare"] {
  return (
    type === "atLeast" ||
    type === "greaterThan" ||
    type === "atMost" ||
    type === "lessThan" ||
    type === "equalTo" ||
    type === "notEqualTo"
  );
}

function addCounted(list: Counted[], name: string, count: number): void {
  const existing = list.find((entry) => normalizeName(entry.name) === normalizeName(name));
  if (existing) existing.count += count;
  else list.push({ name, count });
}

/** A per-parent limit from an entry's constraints: how many each model or unit must (min) or may (max) take. */
function limit(node: BsNode, type: "min" | "max"): number {
  const constraint = node.constraints?.find(
    (c) => c.type === type && c.field === "selections" && c.scope === "parent",
  );
  const value = Number(constraint?.value ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Every rule's text, by rule key: core rules first, then faction rules, then Wahapedia's. */
function compileRules(
  catalogues: Catalogues,
  wahapedia: Wahapedia,
  factionId: string | undefined,
): Record<string, Ability> {
  const rules: Record<string, Ability> = {};
  const add = (name: string, html: string) => {
    const key = ruleKey(name);
    const existing = rules[key];
    // Prefer the generic rule ("Feel No Pain") over a variant ("Feel No Pain 5+").
    if (!html || (existing && existing.name.length <= name.length)) return;
    rules[key] = { name, html };
  };
  const files = [...catalogues.files].sort(
    (a, b) => Number(b.isGameSystem) - Number(a.isGameSystem),
  );
  for (const file of files) {
    for (const rule of [...(file.root.sharedRules ?? []), ...(file.root.rules ?? [])]) {
      if (rule.name) add(rule.name, bsdataToHtml(rule.description ?? ""));
    }
  }
  for (const ability of wahapedia.abilities) {
    if (ability.factionId === "" || ability.factionId === factionId) {
      if (!rules[ruleKey(ability.name)]) {
        add(ability.name, sanitizeWahapediaHtml(ability.description));
      }
    }
  }
  return rules;
}

/** Where this unit's BSData numbers differ from Wahapedia's, across every option it has. */
function crossCheckUnit(
  wahapedia: Wahapedia,
  datasheetId: string,
  unit: UnitData,
): CrossCheckIssue[] {
  const issues: CrossCheckIssue[] = [];
  const models = wahapedia.models.get(datasheetId) ?? [];
  const lines = [...unit.stats, ...Object.values(unit.models).flatMap((m) => m.stats)];
  const seenLines = new Set<string>();
  for (const line of lines) {
    if (seenLines.has(line.name)) continue;
    seenLines.add(line.name);
    // Unnamed matches only pair a lone stat line with a lone model; a pilot's line
    // (Sir Hekhtur on Canis Rex) isn't the vehicle's.
    const model =
      models.find((m) => comparable(m.name) === comparable(line.name)) ??
      (models.length === 1 && lines.length === 1 ? models[0] : undefined);
    if (!model) continue;
    const pairs: [string, string | undefined, string][] = [
      ["M", line.m, model.m],
      ["T", line.t, model.t],
      ["Sv", line.sv, model.sv],
      ["W", line.w, model.w],
      ["Ld", line.ld, model.ld],
      ["OC", line.oc, model.oc],
      ["InSv", line.invSv, model.invSv],
    ];
    for (const [field, ours, theirs] of pairs) {
      if (!sameValue(ours, theirs)) {
        issues.push({
          unit: unit.name,
          field: `${line.name} ${field}`,
          bsdata: ours ?? "",
          wahapedia: theirs,
        });
      }
    }
  }

  const weapons = wahapedia.wargear.get(datasheetId) ?? [];
  const items = [
    ...Object.values(unit.items),
    ...Object.values(unit.models).flatMap((m) => Object.values(m.items)),
  ];
  const seenProfiles = new Set<string>();
  for (const item of items) {
    for (const [type, profiles] of [
      ["ranged", item.ranged],
      ["melee", item.melee],
    ] as const) {
      for (const profile of profiles) {
        const id = `${type}:${profile.name}`;
        if (seenProfiles.has(id)) continue;
        seenProfiles.add(id);
        const theirs = weapons.find(
          (w) =>
            w.type.toLowerCase() === type &&
            comparable(stripArrow(w.name)) === comparable(stripArrow(profile.name)),
        );
        if (!theirs) continue;
        const pairs: [string, string, string][] = [
          ["Range", profile.range, theirs.range],
          ["A", profile.attacks, theirs.attacks],
          ["BS/WS", profile.skill, theirs.skill],
          ["S", profile.strength, theirs.strength],
          ["AP", profile.ap, theirs.ap],
          ["D", profile.damage, theirs.damage],
        ];
        for (const [field, ours, value] of pairs) {
          if (!sameValue(ours, value)) {
            issues.push({
              unit: unit.name,
              field: `${profile.name} ${field}`,
              bsdata: ours,
              wahapedia: value,
            });
          }
        }
      }
    }
  }
  return issues;
}

/** Applies one modifier to a profile field. */
export function applyModifier(
  target: Partial<Record<ProfileField, string | string[]>>,
  field: ProfileField,
  op: ModifierOp,
  value: string,
): void {
  const current = target[field];
  if (field === "keywords") {
    const keywords = Array.isArray(current) ? current : [];
    const added = splitKeywords(value);
    target.keywords =
      op === "set" ? added : [...keywords, ...added.filter((k) => !keywords.includes(k))];
    return;
  }
  if (typeof current !== "string" && current !== undefined) return;
  if (op === "set") target[field] = value;
  else if (op === "increment" || op === "decrement") {
    target[field] = shiftNumber(current ?? "", (op === "increment" ? 1 : -1) * Number(value));
  }
  // Appending to a number ("+0") is crusade bookkeeping; leave the value alone.
}

/** "5+" shifted by -1 is "4+"; "D6" and other dice expressions are left alone. */
function shiftNumber(value: string, by: number): string {
  const match = /^(-?\d+)(.*)$/.exec(value);
  if (!match || Number.isNaN(by)) return value;
  return `${Number(match[1]) + by}${match[2]}`;
}

function addCategories(
  categories: string[],
  target: { keywords: string[]; factionKeywords: string[] },
): void {
  for (const category of categories) {
    if (FACTION_PREFIX.test(category)) {
      const faction = category.replace(FACTION_PREFIX, "");
      if (!target.factionKeywords.includes(faction)) target.factionKeywords.push(faction);
    } else if (!NOT_KEYWORDS.has(category.toLowerCase()) && !target.keywords.includes(category)) {
      target.keywords.push(category);
    }
  }
}

function isWeapon(profile: BsNode): boolean {
  return profile.typeName === "Ranged Weapons" || profile.typeName === "Melee Weapons";
}

function characteristic(profile: BsNode, name: string): string {
  const found = profile.characteristics?.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return (found?.$text ?? "").trim();
}

function description(profile: BsNode): string {
  return characteristic(profile, "Description") || characteristic(profile, "Descriptions");
}

function splitKeywords(value: string): string[] {
  return value && value !== "-"
    ? value
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];
}

function pushAbility(list: Ability[], profile: BsNode): void {
  const name = profile.name ?? "";
  if (list.some((ability) => ability.name === name)) return;
  // Profiles that aren't plain abilities, such as Hymns of Battle, keep their type as a prefix.
  const label =
    profile.typeName && profile.typeName !== "Abilities" ? `${profile.typeName}: ${name}` : name;
  list.push({ name: label, html: bsdataToHtml(description(profile)) });
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

/** `5+` and `5`, `6"` and `6`, `N/A` and an empty cell all mean the same thing. */
function sameValue(a: string | undefined, b: string | undefined): boolean {
  const clean = (value: string | undefined) => {
    const v = (value ?? "")
      .toLowerCase()
      // Footnote marks and qualifiers ("5+*", "5+ (Ranged)") aren't part of the value.
      .replace(/\(.*?\)|\*/g, "")
      .replace(/[+"\s]/g, "")
      .replace(/[–−]/g, "-");
    return v === "n/a" || v === "-" ? "" : v;
  };
  return clean(a) === clean(b);
}

function stripArrow(name: string): string {
  return name.replace(/^➤\s*/, "");
}
