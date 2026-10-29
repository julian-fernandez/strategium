import type { ListItem, ListUnit } from "../list/parse";
import { bsdataToHtml } from "../markup";
import type { Ability, Datasheet, StatLine, WeaponProfile, WeaponRow } from "../types";
import { type BsNode, type Catalogues, normalizeName, sameName } from "./catalogues";

const NOT_KEYWORDS = new Set(["warlord", "configuration"]);
const FACTION_PREFIX = /^Faction: /;

/**
 * Builds one unit's card from BSData: only the weapons and wargear the list
 * took, with how many models carry each.
 */
export function buildDatasheet(catalogues: Catalogues, unit: ListUnit, id: string): Datasheet {
  const sheet: Datasheet = {
    id,
    name: unit.name,
    points: unit.points,
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

  const root = catalogues.findUnit(unit.name);
  if (!root) {
    sheet.warnings.push(`BSData has no unit named "${unit.name}".`);
    return sheet;
  }

  const builder = new SheetBuilder(catalogues, root, sheet);
  builder.addUnitLevel(root);

  for (const group of unit.groups) builder.addModelGroup(group.name, group.count, group.items);
  for (const item of unit.items) builder.addTopLevelItem(item);

  if (sheet.models.length === 0) sheet.models.push({ name: root.name ?? unit.name, count: 1 });
  sheet.modelCount = sheet.models.reduce((sum, model) => sum + model.count, 0);
  if (sheet.stats.length === 0) sheet.warnings.push(`No stat line found for "${unit.name}".`);

  if (unit.enhancement) builder.addEnhancement(unit.enhancement);
  return sheet;
}

class SheetBuilder {
  private readonly weaponRows = new Map<string, WeaponRow>();

  constructor(
    private readonly catalogues: Catalogues,
    private readonly root: BsNode,
    private readonly sheet: Datasheet,
  ) {}

  addUnitLevel(node: BsNode): void {
    for (const profile of this.catalogues.profiles(node)) {
      if (profile.typeName === "Unit") this.addStats(profile);
      else if (
        profile.typeName === "Abilities" &&
        (profile.name === "Leader" || profile.name === "Support")
      ) {
        this.sheet.attachTo = { title: profile.name, html: bsdataToHtml(description(profile)) };
      } else if (profile.typeName === "Abilities") pushAbility(this.sheet.abilities, profile);
      else if (profile.typeName && !isWeapon(profile)) pushAbility(this.sheet.abilities, profile);
    }
    for (const rule of this.catalogues.rules(node)) {
      const list = rule.core ? this.sheet.coreAbilities : this.sheet.factionAbilities;
      if (!list.includes(rule.name)) list.push(rule.name);
    }
    this.addCategories(node);
  }

  addModelGroup(name: string, count: number, items: ListItem[]): void {
    const model = this.findModel(name);
    if (!model) {
      this.sheet.warnings.push(`BSData has no model named "${name}" in ${this.sheet.name}.`);
    } else {
      for (const profile of this.catalogues.profiles(model)) {
        if (profile.typeName === "Unit") this.addStats(profile);
      }
      this.addCategories(model);
    }
    this.sheet.models.push({ name, count });
    for (const item of items) this.addItem(item, model ?? this.root);
  }

  /** A `• Nx Name` line with nothing under it: a model with no listed wargear, or the unit's own gear. */
  addTopLevelItem(item: ListItem): void {
    const entry = this.catalogues.findEntry(this.root, item.name);
    if (entry?.type === "model") {
      this.addModelGroup(item.name, item.count, []);
      return;
    }
    this.addItem(item, this.root);
  }

  addEnhancement(name: string): void {
    const entry = this.catalogues.findEntry(this.root, name);
    const profile =
      entry && this.catalogues.profiles(entry).find((p) => p.typeName === "Abilities");
    if (!profile) {
      this.sheet.warnings.push(`BSData has no enhancement named "${name}" for ${this.sheet.name}.`);
      this.sheet.enhancement = { name, html: "" };
      return;
    }
    this.sheet.enhancement = {
      name: profile.name ?? name,
      html: bsdataToHtml(description(profile)),
    };
  }

  private addItem(item: ListItem, scope: BsNode): void {
    const entry =
      this.catalogues.findEntry(scope, item.name) ??
      this.catalogues.findEntry(this.root, item.name);
    if (!entry) {
      this.sheet.warnings.push(`BSData has no wargear named "${item.name}" in ${this.sheet.name}.`);
      return;
    }

    let profiles = this.catalogues.profiles(entry);
    // Combined options ("Holy Pistol and Power Weapon") keep their profiles one level down.
    if (!profiles.some((p) => isWeapon(p) || p.typeName === "Abilities")) {
      profiles = this.catalogues
        .children(entry)
        .flatMap((child) => this.catalogues.profiles(child));
    }

    const ranged = profiles.filter((p) => p.typeName === "Ranged Weapons");
    const melee = profiles.filter((p) => p.typeName === "Melee Weapons");
    if (ranged.length) this.addWeapon(entry, ranged, item.count, false);
    if (melee.length) this.addWeapon(entry, melee, item.count, true);
    for (const profile of profiles) {
      if (!isWeapon(profile) && profile.typeName) pushAbility(this.sheet.wargearAbilities, profile);
    }
  }

  /** Adds one wargear entry's profiles of one type. The count is per entry, not per profile. */
  private addWeapon(entry: BsNode, profiles: BsNode[], count: number, melee: boolean): void {
    const key = `${melee ? "melee" : "ranged"}:${normalizeName(entry.name)}`;
    let row = this.weaponRows.get(key);
    if (!row) {
      // Several profiles on one entry: name the row after the entry, like the official cards.
      const name = profiles.length > 1 ? entry.name : profiles[0]?.name;
      row = { name: name ?? entry.name ?? "", count: 0, profiles: profiles.map(weaponProfile) };
      this.weaponRows.set(key, row);
      (melee ? this.sheet.melee : this.sheet.ranged).push(row);
    }
    row.count += count;
  }

  private addStats(profile: BsNode): void {
    const value = (name: string) => characteristic(profile, name);
    const line: StatLine = {
      name: profile.name ?? "",
      m: value("M"),
      t: value("T"),
      sv: value("Sv"),
      w: value("W"),
      ld: value("LD"),
      oc: value("OC"),
      invSv: value("InSv") || undefined,
    };
    const same = this.sheet.stats.find((existing) => sameStats(existing, line));
    if (!same) this.sheet.stats.push(line);
  }

  private addCategories(node: BsNode): void {
    for (const category of this.catalogues.categories(node)) {
      if (FACTION_PREFIX.test(category)) {
        const faction = category.replace(FACTION_PREFIX, "");
        if (!this.sheet.factionKeywords.includes(faction)) this.sheet.factionKeywords.push(faction);
      } else if (
        !NOT_KEYWORDS.has(category.toLowerCase()) &&
        !this.sheet.keywords.includes(category)
      ) {
        this.sheet.keywords.push(category);
      }
    }
  }

  private findModel(name: string): BsNode | undefined {
    if (this.root.type === "model" && sameName(this.root.name, name)) return this.root;
    return this.catalogues.findEntry(this.root, name, (node) => node.type === "model");
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

function weaponProfile(profile: BsNode): WeaponProfile {
  const keywords = characteristic(profile, "Keywords");
  return {
    name: profile.name ?? "",
    range: characteristic(profile, "Range"),
    attacks: characteristic(profile, "A"),
    skill: characteristic(profile, "BS") || characteristic(profile, "WS"),
    strength: characteristic(profile, "S"),
    ap: characteristic(profile, "AP"),
    damage: characteristic(profile, "D"),
    keywords:
      keywords && keywords !== "-"
        ? keywords
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean)
        : [],
  };
}

function pushAbility(list: Ability[], profile: BsNode): void {
  const name = profile.name ?? "";
  if (list.some((ability) => ability.name === name)) return;
  const text = description(profile);
  // Profiles that aren't plain abilities, such as Hymns of Battle, keep their type as a prefix.
  const label =
    profile.typeName && profile.typeName !== "Abilities" ? `${profile.typeName}: ${name}` : name;
  list.push({ name: label, html: bsdataToHtml(text) });
}

function sameStats(a: StatLine, b: StatLine): boolean {
  return (
    a.m === b.m &&
    a.t === b.t &&
    a.sv === b.sv &&
    a.w === b.w &&
    a.ld === b.ld &&
    a.oc === b.oc &&
    a.invSv === b.invSv
  );
}
