import { z } from "zod";
import type { AttachmentRole } from "../types";
import type { ArmyList, ListItem, ListModelGroup, ListUnit } from "./types";
import { parseXml, type XmlElement } from "./xml";
import { readZipEntry } from "./zip";

/**
 * Reads BattleScribe-style rosters: the `.ros` XML, the `.rosz` ZIP around
 * it, New Recruit's JSON copy of the same roster, and ListForge's share JSON,
 * which carries the roster XML in `rosterData`. All of them become one
 * selection tree first, and that tree becomes an `ArmyList` in one place.
 */

/** One selection in a roster, whichever file it came from. */
type Selection = {
  id?: string;
  name: string;
  /** `model`, `unit` or `upgrade`. */
  type: string;
  /** The total for the whole selection, e.g. every bolter in the squad. */
  number: number;
  /** The entry group it was picked from, e.g. `Wargear` or `Weapons::Melee weapons`. */
  group?: string;
  /** ListForge: on a leader, the id of the selection it leads. */
  attached?: string;
  costs: { name: string; value: number }[];
  categories: { name: string; primary: boolean }[];
  selections: Selection[];
};

type Roster = {
  name?: string;
  generatedBy?: string;
  /** ListForge writes the catalogue, points, detachment and disposition on `<roster>` itself. */
  catalogue?: string;
  points?: number;
  detachment?: string;
  disposition?: string;
  costs: { name: string; value: number }[];
  forces: { catalogueName?: string; selections: Selection[] }[];
};

const POINTS = "pts";
const DETACHMENT_POINTS = "Detachment Points";
const ENHANCEMENTS = "Enhancements";
const CONFIGURATION_NAMES = new Set([
  "battle size",
  "detachment",
  "detachments",
  "force disposition",
  "show/hide options",
  "rituals reference",
]);
const DEFAULT_ROSTER_NAMES = new Set(["unnamed list", "new roster"]);
const SUPER_FACTION = /^(?:Imperium|Chaos|Aeldari|Xenos) - /i;
const BATTLE_SIZE = /^(?:\d+\.\s*)?(.+?)\s*\(\s*([\d,]+)\s*points?(?:\s+limit)?\s*\)$/i;

// Detection

/** True when the text is a BattleScribe roster XML (`.ros`, or ListForge's `rosterData`). */
export function isRosterXml(text: string): boolean {
  return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<roster[\s>/]/.test(text);
}

/** True when the text is New Recruit's roster JSON or a ListForge share payload. */
export function isRosterJson(text: string): boolean {
  const json = tryJson(text);
  if (!isRecord(json)) return false;
  if (typeof json.rosterData === "string") return isRosterXml(json.rosterData);
  return isRecord(json.roster) && Array.isArray(json.roster.forces);
}

// Reading

/** Reads a `.ros` roster. Throws when the XML is broken or isn't a roster. */
export function parseRosterXml(xml: string): ArmyList {
  return toArmyList(rosterFromXml(xml));
}

/** Reads New Recruit's roster JSON or a ListForge share payload. Throws when it's neither. */
export function parseRosterJson(text: string): ArmyList {
  const json = tryJson(text);
  if (json === undefined) throw new Error("This roster isn't valid JSON.");

  const share = listForgeShare.safeParse(json);
  if (share.success) {
    const { rosterData, name, catalogue, points, detachment, disposition } = share.data;
    const roster = rosterFromXml(rosterData);
    return toArmyList(
      {
        ...roster,
        name: roster.name || name,
        catalogue: roster.catalogue || catalogue,
        points: roster.points ?? points,
        detachment: roster.detachment || detachment,
        disposition: roster.disposition || disposition,
      },
      "ListForge",
    );
  }

  const envelope = newRecruitEnvelope.safeParse(json);
  if (!envelope.success) {
    const issue = envelope.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    throw new Error(`This JSON isn't a roster New Recruit or ListForge wrote${where}.`);
  }
  return toArmyList(rosterFromJson(envelope.data.roster));
}

/** Unpacks a `.rosz` and returns the `.ros` XML inside it. */
export async function readRosz(bytes: Uint8Array): Promise<string> {
  const entry = await readZipEntry(bytes, (name) => /\.ros$/i.test(name));
  if (!entry) throw new Error("This .rosz has no .ros roster inside it.");
  return new TextDecoder().decode(entry.data);
}

// XML to the selection tree

function rosterFromXml(xml: string): Roster {
  const root = parseXml(xml);
  if (localName(root.name) !== "roster") {
    throw new Error(`This XML isn't a roster: its root is <${root.name}>, not <roster>.`);
  }
  const a = root.attributes;
  return {
    name: a.name,
    generatedBy: a.generatedBy || undefined,
    catalogue: a.catalogue || undefined,
    points: a.points ? toNumber(a.points) : undefined,
    detachment: a.detachment || undefined,
    disposition: a.disposition || undefined,
    costs: costsFromXml(root),
    forces: forcesFromXml(root),
  };
}

/** Forces can nest (a force inside a force), so they're flattened in document order. */
function forcesFromXml(parent: XmlElement): Roster["forces"] {
  return childrenNamed(parent, "forces")
    .flatMap((forces) => childrenNamed(forces, "force"))
    .flatMap((force) => [
      {
        catalogueName: force.attributes.catalogueName,
        selections: selectionsFromXml(force),
      },
      ...forcesFromXml(force),
    ]);
}

function selectionsFromXml(parent: XmlElement): Selection[] {
  return childrenNamed(parent, "selections")
    .flatMap((selections) => childrenNamed(selections, "selection"))
    .map((element) => {
      const a = element.attributes;
      return {
        id: a.id || undefined,
        name: (a.name ?? "").trim(),
        type: a.type ?? "",
        number: a.number ? toNumber(a.number) : 1,
        group: a.group || undefined,
        attached: a.attached || undefined,
        costs: costsFromXml(element),
        categories: childrenNamed(element, "categories")
          .flatMap((categories) => childrenNamed(categories, "category"))
          .map((category) => ({
            name: category.attributes.name ?? "",
            primary: category.attributes.primary === "true",
          })),
        selections: selectionsFromXml(element),
      };
    });
}

function costsFromXml(parent: XmlElement): Selection["costs"] {
  return childrenNamed(parent, "costs")
    .flatMap((costs) => childrenNamed(costs, "cost"))
    .map((cost) => ({ name: cost.attributes.name ?? "", value: toNumber(cost.attributes.value) }));
}

function childrenNamed(parent: XmlElement, name: string): XmlElement[] {
  return parent.children.filter((child) => localName(child.name) === name);
}

/** `<bs:selection>` and `<selection>` are the same element. */
function localName(name: string): string {
  return name.slice(name.indexOf(":") + 1);
}

// JSON to the selection tree

const jsonNumber = z.union([z.number(), z.string()]);

const jsonCost = z.looseObject({ name: z.string(), value: jsonNumber });

const jsonCategory = z.looseObject({
  name: z.string(),
  primary: z.union([z.boolean(), z.string()]).optional(),
});

type JsonSelection = {
  id?: string;
  name: string;
  type?: string;
  number?: number | string;
  group?: string;
  attached?: string;
  costs?: z.infer<typeof jsonCost>[];
  categories?: z.infer<typeof jsonCategory>[];
  selections?: JsonSelection[];
};

const jsonSelection: z.ZodType<JsonSelection> = z.lazy(() =>
  z.looseObject({
    id: z.string().optional(),
    name: z.string(),
    type: z.string().optional(),
    number: jsonNumber.optional(),
    group: z.string().optional(),
    attached: z.string().optional(),
    costs: z.array(jsonCost).optional(),
    categories: z.array(jsonCategory).optional(),
    selections: z.array(jsonSelection).optional(),
  }),
);

type JsonForce = {
  catalogueName?: string;
  selections?: JsonSelection[];
  forces?: JsonForce[];
};

const jsonForce: z.ZodType<JsonForce> = z.lazy(() =>
  z.looseObject({
    catalogueName: z.string().optional(),
    selections: z.array(jsonSelection).optional(),
    forces: z.array(jsonForce).optional(),
  }),
);

/** New Recruit's JSON: the roster XML one-to-one, under a `roster` key. */
const newRecruitEnvelope = z.looseObject({
  roster: z.looseObject({
    name: z.string().optional(),
    generatedBy: z.string().optional(),
    costs: z.array(jsonCost).optional(),
    forces: z.array(jsonForce),
  }),
});

/** ListForge's share payload. Its rules, stratagems and text exports aren't read. */
const listForgeShare = z.looseObject({
  rosterData: z.string(),
  name: z.string().optional(),
  catalogue: z.string().optional(),
  points: z.number().optional(),
  detachment: z.string().optional(),
  disposition: z.string().optional(),
});

function rosterFromJson(roster: z.infer<typeof newRecruitEnvelope>["roster"]): Roster {
  return {
    name: roster.name,
    generatedBy: roster.generatedBy || undefined,
    costs: costsFromJson(roster.costs),
    forces: roster.forces.flatMap(forceFromJson),
  };
}

function forceFromJson(force: JsonForce): Roster["forces"] {
  return [
    {
      catalogueName: force.catalogueName,
      selections: (force.selections ?? []).map(selectionFromJson),
    },
    ...(force.forces ?? []).flatMap(forceFromJson),
  ];
}

function selectionFromJson(selection: JsonSelection): Selection {
  return {
    id: selection.id || undefined,
    name: selection.name.trim(),
    type: selection.type ?? "",
    number: selection.number === undefined ? 1 : toNumber(selection.number),
    group: selection.group || undefined,
    attached: selection.attached || undefined,
    costs: costsFromJson(selection.costs),
    categories: (selection.categories ?? []).map((category) => ({
      name: category.name,
      primary: category.primary === true || category.primary === "true",
    })),
    selections: (selection.selections ?? []).map(selectionFromJson),
  };
}

function costsFromJson(costs: z.infer<typeof jsonCost>[] | undefined): Selection["costs"] {
  return (costs ?? []).map((cost) => ({ name: cost.name, value: toNumber(cost.value) }));
}

// The selection tree to an ArmyList

function toArmyList(roster: Roster, exporter = roster.generatedBy): ArmyList {
  const warnings: string[] = [];

  const catalogues = [...new Set(roster.forces.map((f) => f.catalogueName).filter(isPresent))];
  const catalogue = catalogues[0] ?? roster.catalogue ?? "";
  const faction = factionName(catalogue);
  if (!faction) warnings.push("Couldn't find the faction: the roster names no catalogue.");
  if (catalogues.length > 1) {
    warnings.push(`The roster has forces from ${catalogues.join(", ")}; read it as ${faction}.`);
  }

  const selections = roster.forces.flatMap((force) => force.selections);
  const settings = selections.filter(isConfiguration);
  const setting = (pattern: RegExp) => settings.filter((s) => pattern.test(s.name));

  const detachments = setting(/^detachments?$/i).flatMap((s) => s.selections);
  const detachmentText =
    detachments.map((d) => d.name).join(" and ") || roster.detachment?.trim() || "";
  if (!detachmentText) warnings.push("Couldn't find the detachment in the roster.");
  const pointCosts = detachments.flatMap((d) =>
    d.costs.filter((c) => c.name === DETACHMENT_POINTS),
  );

  const sizeName = setting(/^battle size$/i)[0]?.selections[0]?.name;
  const battleSize = sizeName ? parseBattleSize(sizeName) : undefined;
  if (sizeName && !battleSize) warnings.push(`Couldn't read the battle size "${sizeName}".`);

  const disposition =
    setting(/^force disposition$/i)[0]?.selections[0]?.name ?? roster.disposition?.trim();

  const unitSelections = selections.filter((s) => !isConfiguration(s));
  const units = unitSelections.map((selection) => toUnit(selection, warnings));
  linkAttachments(unitSelections, units, warnings);

  const declared = sumCost(roster.costs, POINTS) || roster.points;
  const total = selections.reduce((sum, s) => sum + totalCost(s, POINTS), 0);
  if (declared && declared !== total) {
    warnings.push(`The units add up to ${total} points, but the roster says ${declared}.`);
  }

  const note = roster.name?.trim();
  return {
    ...(note && !DEFAULT_ROSTER_NAMES.has(note.toLowerCase()) ? { note } : {}),
    faction,
    detachmentText,
    ...(pointCosts.length ? { detachmentPoints: sumCost(pointCosts, DETACHMENT_POINTS) } : {}),
    ...(disposition ? { disposition } : {}),
    ...(battleSize ? { battleSize } : {}),
    units,
    ...(exporter ? { exporter } : {}),
    warnings,
  };
}

function toUnit(selection: Selection, warnings: string[]): ListUnit {
  if (selection.type !== "model" && selection.type !== "unit") {
    warnings.push(
      `"${selection.name}" isn't marked as a unit or a model; read it as a unit anyway.`,
    );
  }

  const enhancements = descendants(selection).filter(isEnhancement);
  const [enhancement, ...extra] = enhancements;
  if (enhancement && extra.length) {
    warnings.push(
      `${selection.name} has more than one enhancement (${enhancements.map((e) => e.name).join(", ")}); kept ${enhancement.name}.`,
    );
  }

  const unit: ListUnit = {
    name: selection.name,
    points: totalCost(selection, POINTS),
    section: selection.categories.find((c) => c.primary)?.name ?? "",
    isWarlord: descendants(selection).some(isWarlord),
    ...(enhancement ? { enhancement: enhancement.name } : {}),
    groups: [],
    items: [],
  };
  for (const child of selection.selections) {
    if (isHelper(child)) continue;
    if (child.type === "model") unit.groups.push(toGroup(child));
    else addLeaves(unit.items, child);
  }
  return unit;
}

function toGroup(model: Selection): ListModelGroup {
  const items: ListItem[] = [];
  for (const child of model.selections) addLeaves(items, child);
  return { count: model.number, name: model.name, items };
}

/** A wrapper upgrade (`X and 2x Y`) stands for the leaves under it. Same-named leaves add up. */
function addLeaves(items: ListItem[], selection: Selection): void {
  if (isHelper(selection)) return;
  if (selection.selections.length) {
    for (const child of selection.selections) addLeaves(items, child);
    return;
  }
  const existing = items.find((item) => item.name === selection.name);
  if (existing) existing.count += selection.number;
  else items.push({ count: selection.number, name: selection.name });
}

/**
 * ListForge marks a leader with `attached="<bodyguard id>"`. Each bodyguard
 * and the characters leading it form one group, numbered in roster order.
 */
function linkAttachments(selections: Selection[], units: ListUnit[], warnings: string[]): void {
  const indexById = new Map<string, number>();
  selections.forEach((selection, index) => {
    if (selection.id) indexById.set(selection.id, index);
  });

  const bodyguardOf = new Map<number, number>();
  selections.forEach((selection, index) => {
    const target = selection.attached ?? selection.selections.find((s) => s.attached)?.attached;
    if (!target) return;
    const bodyguard = indexById.get(target);
    if (bodyguard === undefined || bodyguard === index) {
      warnings.push(`${selection.name} is attached to a unit that isn't in the roster.`);
      return;
    }
    bodyguardOf.set(index, bodyguard);
  });

  const bodyguards = new Set(bodyguardOf.values());
  const groupOf = new Map<number, number>();
  selections.forEach((selection, index) => {
    const unit = units[index];
    const bodyguard = bodyguards.has(index) ? index : bodyguardOf.get(index);
    if (!unit || bodyguard === undefined) return;
    const group = groupOf.get(bodyguard) ?? groupOf.size + 1;
    groupOf.set(bodyguard, group);
    unit.attachment = { role: index === bodyguard ? "bodyguard" : characterRole(selection), group };
  });
}

/** Support characters carry the `Support` category instead of `Leader`. */
function characterRole(selection: Selection): AttachmentRole {
  const has = (name: string) =>
    selection.categories.some((c) => c.name.toLowerCase() === name) ||
    selection.selections.some((s) => s.categories.some((c) => c.name.toLowerCase() === name));
  return has("support") && !has("leader") ? "support" : "leader";
}

// Selection helpers

function isConfiguration(selection: Selection): boolean {
  return (
    CONFIGURATION_NAMES.has(selection.name.toLowerCase()) ||
    selection.categories.some((c) => c.primary && c.name === "Configuration")
  );
}

function isWarlord(selection: Selection): boolean {
  return selection.name.toLowerCase() === "warlord";
}

/**
 * Enhancements cost one `Enhancements` point (ListForge writes it; New Recruit
 * writes non-zero costs). New Recruit also names the entry group they come
 * from, e.g. `Enhancements`.
 */
function isEnhancement(selection: Selection): boolean {
  return (
    sumCost(selection.costs, ENHANCEMENTS) > 0 ||
    (selection.group ?? "").split("::").some((part) => /\benhancements?\b/i.test(part))
  );
}

/** Selections that aren't wargear: the warlord marker, the enhancement, configuration. */
function isHelper(selection: Selection): boolean {
  return isWarlord(selection) || isEnhancement(selection) || isConfiguration(selection);
}

function descendants(selection: Selection): Selection[] {
  return selection.selections.flatMap((child) => [child, ...descendants(child)]);
}

/** A selection's own cost lists only itself; the unit's price is the whole subtree. */
function totalCost(selection: Selection, name: string): number {
  return (
    sumCost(selection.costs, name) +
    selection.selections.reduce((sum, child) => sum + totalCost(child, name), 0)
  );
}

function sumCost(costs: Selection["costs"], name: string): number {
  return costs.reduce((sum, cost) => (cost.name === name ? sum + cost.value : sum), 0);
}

// Values

/**
 * `Chaos - Thousand Sons` is Thousand Sons. A third part, as in ListForge's
 * `Imperium - Adeptus Custodes - Codex Adeptus Custodes 2026 [Homebrew]` or
 * BSData's `… - Library`, names a variant of the faction and is dropped.
 */
function factionName(catalogue: string): string {
  const name = catalogue.trim();
  if (!SUPER_FACTION.test(name)) return name;
  return (name.replace(SUPER_FACTION, "").split(" - ")[0] ?? "").trim();
}

/** `Incursion (1000 Point limit)`, or ListForge's `2. Strike Force (2000 Point limit)`. */
function parseBattleSize(text: string): { name: string; points: number } | undefined {
  const match = BATTLE_SIZE.exec(text.trim());
  if (!match) return undefined;
  return { name: match[1] ?? "", points: toNumber(match[2]) };
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  const number = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function tryJson(text: string): unknown {
  const trimmed = stripBom(text).trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}
