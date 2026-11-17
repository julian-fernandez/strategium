import { stripTags } from "../../../shared/markup";
import type {
  Ability,
  Army,
  AttachedGroup,
  Datasheet,
  Stratagem,
  WeaponRow,
} from "../../../shared/types";

export type DeckOptions = {
  /** Where a unit's leaders and supports print: see LeaderPlacement. */
  leaders: LeaderPlacement;
  /** Print double-sided: every card gets a back, so each stays on its own sheet. */
  duplex: boolean;
  /** Four stratagem cards to a page, after the datasheets; double-sided, the pages back onto each other. */
  stratagems: boolean;
  /** "Paragon Warsuits #1, #2, #3" for units that share a name. */
  numberDuplicates: boolean;
  /** A cover first: the faction, and the list's name, your message and an image if you like. */
  cover: boolean;
  /**
   * Full datasheets: after each unit's card, a wargear page with every other
   * weapon it could take and its wargear options, as on the back of the official cards.
   */
  fullDatasheets: boolean;
  /** A first card with the army rule, the detachment rules and the enhancements taken. */
  armyRules: boolean;
  /** Reference pages at the end with every core ability and weapon keyword the cards name. */
  glossary: boolean;
  /** A strip kept clear along one edge of every page, for a spiral or rings. */
  binding: Binding;
  /** The paper: A5, or A4 with two A5 pages on each sheet, to cut in half. */
  paper: Paper;
};

/** Where printed cards are bound, if they are: the edge whose strip stays clear. */
export type Binding = "none" | "left" | "top";

/** A5 pages, or two of them on each A4 sheet. */
export type Paper = "a5" | "a4";

/**
 * Where a unit's leaders and supports print. "own": each on its own sheet, in
 * list order. "back": right after the unit, the first on its back. "facing":
 * double-sided, the unit on a back and its first leader on the next front, so
 * an open booklet shows both; single-sided, as "back".
 */
export type LeaderPlacement = "own" | "back" | "facing";

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  leaders: "back",
  duplex: true,
  stratagems: true,
  numberDuplicates: true,
  cover: false,
  fullDatasheets: false,
  armyRules: true,
  glossary: true,
  binding: "none",
  paper: "a5",
};

/** A titled run of rules on the army rules card: the army rule, one detachment, the enhancements. */
export type RulesSection = { title: string; rules: (Ability & { note?: string })[] };

export type DeckPage =
  | { kind: "cover"; key: string }
  | { kind: "datasheet"; key: string; unit: Datasheet }
  | {
      kind: "wargear";
      key: string;
      unit: Datasheet;
      items: WargearItem[];
      part: number;
      parts: number;
    }
  | { kind: "stratagems"; key: string; stratagems: Stratagem[] }
  | { kind: "army-rules"; key: string; sections: RulesSection[]; part: number; parts: number }
  | { kind: "glossary"; key: string; rules: Ability[]; part: number; parts: number }
  | { kind: "blank"; key: string };

const STRATAGEMS_PER_PAGE = 4;
/**
 * Characters of rules text a page holds at its smallest type. The army rules
 * card sets two columns, the reference three, smaller; past this a page splits.
 */
const ARMY_RULES_BUDGET = 5200;
const GLOSSARY_BUDGET = 7600;

/**
 * The share of a budget to fill, per card, once one of its pages was seen to
 * spill at its smallest type: characters are only an estimate of the lines a
 * rule takes, so the screen corrects it.
 */
export type Squeeze = Partial<Record<"army-rules" | "glossary", number>>;

/**
 * The print order: the cover, the army rules card (its first page on the
 * cover's back), each datasheet followed by its back, the stratagem deck,
 * then the rules reference. Every unit, characters
 * included, prints on the same full datasheet. An attached unit's characters
 * follow it, the first on its back, or facing it (see LeaderPlacement).
 * Double-sided, a unit with nothing behind it gets a blank back.
 */
export function buildDeck(
  army: Army,
  options: DeckOptions,
  squeeze: Squeeze = {},
  /** Wargear pages to add, by unit id, for a unit whose wargear was seen to spill. */
  wargearExtra: Record<string, number> = {},
): DeckPage[] {
  const pages: DeckPage[] = [];
  const byId = new Map(army.units.map((unit) => [unit.id, unit]));
  const groupFor = (unit: Datasheet): AttachedGroup | undefined =>
    army.groups.find((group) => group.bodyguardId === unit.id && group.characterIds.length > 0);
  const grouped = options.leaders !== "own";
  const facing = options.leaders === "facing" && options.duplex;
  const onBack = new Set(
    grouped ? army.groups.filter((g) => g.bodyguardId).flatMap((g) => g.characterIds) : [],
  );

  const pushBlank = (key: string) => {
    if (options.duplex) pages.push({ kind: "blank", key: `blank-${key}` });
  };

  if (options.cover) pages.push({ kind: "cover", key: "cover" });

  if (options.armyRules) {
    const budget = ARMY_RULES_BUDGET * (squeeze["army-rules"] ?? 1);
    const parts = paginate(splitSections(armyRulesSections(army), budget), sectionLength, budget);
    parts.forEach((sections, index) => {
      const key = `army-rules-${index}`;
      pages.push({ kind: "army-rules", key, sections, part: index + 1, parts: parts.length });
      // The first page backs the cover, if there is one; the others each get a sheet.
      if (!(options.cover && index === 0)) pushBlank(key);
    });
  } else if (options.cover) {
    pushBlank("cover");
  }

  for (const unit of army.units) {
    if (onBack.has(unit.id)) continue;
    const group = grouped ? groupFor(unit) : undefined;
    const characters = (group?.characterIds ?? [])
      .map((id) => byId.get(id))
      .filter((c): c is Datasheet => Boolean(c));

    // Facing: the unit goes on a back, a left-hand page, so its first leader on the next
    // front faces it. It takes the blank back before it if there is one, else a front stays
    // blank. Further leaders follow on the back of the first.
    if (facing && characters.length && pages.length % 2 === 0) {
      if (pages.at(-1)?.kind === "blank") pages.pop();
      else pushBlank(`before-${unit.id}`);
    }
    pages.push({ kind: "datasheet", key: unit.id, unit });
    for (const character of characters) {
      pages.push({ kind: "datasheet", key: character.id, unit: character });
    }
    // Full datasheets: the wargear pages come after the unit and its leaders, so a unit on
    // its own has its wargear on its back, and facing cards have theirs facing on the next spread.
    if (options.fullDatasheets) {
      for (const sheet of [unit, ...characters]) {
        const parts = wargearParts(sheet, wargearExtra[sheet.id] ?? 0);
        parts.forEach((items, index) => {
          pages.push({
            kind: "wargear",
            key: `wargear-${sheet.id}-${index}`,
            unit: sheet,
            items,
            part: index + 1,
            parts: parts.length,
          });
        });
      }
    }
    // Double-sided, a unit ends on a back so the next unit starts on a front.
    if (pages.length % 2) pushBlank(unit.id);
  }

  if (options.stratagems) {
    for (let i = 0; i < army.stratagems.length; i += STRATAGEMS_PER_PAGE) {
      const key = `stratagems-${i}`;
      pages.push({
        kind: "stratagems",
        key,
        stratagems: army.stratagems.slice(i, i + STRATAGEMS_PER_PAGE),
      });
    }
    // The pages back onto each other; a blank finishes an odd last sheet.
    const count = Math.ceil(army.stratagems.length / STRATAGEMS_PER_PAGE);
    if (count % 2) pushBlank("stratagems");
  }

  if (options.glossary) {
    // Rules the army rules card prints in full (Acts of Faith) aren't repeated.
    const onArmyCard = new Set(options.armyRules ? army.armyRules.rules.map((r) => r.name) : []);
    const rules = army.glossary.filter((rule) => !onArmyCard.has(rule.name));
    // Reference pages are read as a booklet, so double-sided they back onto each other.
    const parts = paginate(rules, ruleLength, GLOSSARY_BUDGET * (squeeze.glossary ?? 1));
    parts.forEach((part, index) => {
      pages.push({
        kind: "glossary",
        key: `glossary-${index}`,
        rules: part,
        part: index + 1,
        parts: parts.length,
      });
    });
    if (parts.length % 2) pushBlank("glossary");
  }

  return pages;
}

/** What a wargear page lists: a weapon the unit didn't take, or one of its wargear options. */
export type WargearItem =
  | { kind: "ranged" | "melee"; row: WeaponRow }
  | { kind: "option"; html: string };

/**
 * A unit's wargear, split over as many pages as it needs: none when it has
 * nothing else to take. Weapons first, then the options, spread evenly by
 * roughly how many lines each takes; `extra` adds pages for one seen to spill.
 */
export function wargearParts(sheet: Datasheet, extra = 0): WargearItem[][] {
  const items: WargearItem[] = [
    ...(sheet.otherRanged ?? []).map((row) => ({ kind: "ranged" as const, row })),
    ...(sheet.otherMelee ?? []).map((row) => ({ kind: "melee" as const, row })),
    ...(sheet.wargearOptions ?? []).map((html) => ({ kind: "option" as const, html })),
  ];
  if (items.length === 0) return [];
  const total = items.reduce((sum, item) => sum + wargearLines(item), 0);
  const parts = Math.min(MAX_WARGEAR_PAGES, Math.ceil(total / WARGEAR_BUDGET) + extra);
  if (parts <= 1) return [items];
  // Each item on the page its middle falls in, so there are never more pages than planned.
  const share = total / parts;
  const pages: WargearItem[][] = [];
  let used = 0;
  for (const item of items) {
    const lines = wargearLines(item);
    const index = Math.min(parts - 1, Math.floor((used + lines / 2) / share));
    const page = pages[index] ?? [];
    page.push(item);
    pages[index] = page;
    used += lines;
  }
  return pages.filter(Boolean);
}

/**
 * Lines of a wargear page an item takes at the page's smallest type: a weapon
 * row a line per profile, and one more for a weapon with several; an option
 * its text at about a hundred characters a line.
 */
function wargearLines(item: WargearItem): number {
  if (item.kind === "option") return 1 + stripTags(item.html).length / 100;
  return item.row.profiles.length + (item.row.profiles.length > 1 ? 1 : 0);
}

/** Lines a wargear page holds comfortably, and the most pages one unit's wargear can take. */
const WARGEAR_BUDGET = 34;
const MAX_WARGEAR_PAGES = 6;

/** One side of a sheet of paper: one A5 page, or two on A4, top then bottom. Undefined stays empty. */
export type PaperSide = (DeckPage | undefined)[];
export type PaperSheet = { front: PaperSide; back?: PaperSide };

/**
 * The deck on paper. A5: one page a side. A4: two A5 pages a side, top and
 * bottom, for cutting in half. Double-sided, each A5 page's back prints right
 * behind it: turned over its long edge (no binding, or a left one), an A4
 * sheet keeps each back at the same height; turned over its short edge (a top
 * binding), the two backs swap.
 */
export function impose(
  pages: DeckPage[],
  { duplex, paper, binding }: Pick<DeckOptions, "duplex" | "paper" | "binding">,
): PaperSheet[] {
  const a5: { front?: DeckPage; back?: DeckPage }[] = [];
  for (let i = 0; i < pages.length; i += duplex ? 2 : 1) {
    a5.push({ front: pages[i], back: duplex ? pages[i + 1] : undefined });
  }
  if (paper === "a5") {
    return a5.map((sheet) => ({
      front: [sheet.front],
      back: sheet.back ? [sheet.back] : undefined,
    }));
  }
  const sheets: PaperSheet[] = [];
  for (let i = 0; i < a5.length; i += 2) {
    const top = a5[i];
    const bottom = a5[i + 1];
    const front = [top?.front, bottom?.front];
    const backs = [top?.back, bottom?.back];
    sheets.push({
      front,
      back: !duplex ? undefined : binding === "top" ? [backs[1], backs[0]] : backs,
    });
  }
  return sheets;
}

export function armyRulesSections(army: Army): RulesSection[] {
  const { rules, detachments, enhancements } = army.armyRules;
  return [
    ...(rules.length ? [{ title: "Army rule", rules }] : []),
    ...detachments.map((detachment) => ({
      title: `Detachment · ${detachment.name}`,
      rules: detachment.rules,
    })),
    ...(enhancements.length
      ? [
          {
            title: "Enhancements",
            rules: enhancements.map((e) => ({
              name: e.name,
              html: e.html,
              note: [
                e.bearer,
                e.cost ? `${e.cost} pts${/, | ×\d/.test(e.bearer) ? " each" : ""}` : "",
              ]
                .filter(Boolean)
                .join(" · "),
            })),
          },
        ]
      : []),
  ];
}

/**
 * Packs items into pages in order, starting a new page when the next item
 * would take the page past `budget`. An item bigger than a page gets one to
 * itself. When that takes several pages, the items are spread evenly over the
 * same number of pages, so no page is crammed while the last runs short.
 */
export function paginate<T>(items: T[], size: (item: T) => number, budget: number): T[][] {
  const packed = pack(items, size, budget, false);
  if (packed.length < 2) return packed;
  const total = items.reduce((sum, item) => sum + size(item), 0);
  const even = pack(items, size, total / packed.length, true);
  const fits = even.every((page) => page.reduce((sum, item) => sum + size(item), 0) <= budget);
  return even.length === packed.length && fits ? even : packed;
}

/** In order, a page at a time: past `limit`, or (nearest) once an item would end further from it. */
function pack<T>(items: T[], size: (item: T) => number, limit: number, nearest: boolean): T[][] {
  const pages: T[][] = [];
  let page: T[] = [];
  let used = 0;
  for (const item of items) {
    const length = size(item);
    const over = nearest ? used + length / 2 > limit : used + length > limit;
    if (page.length && over) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(item);
    used += length;
  }
  if (page.length) pages.push(page);
  return pages;
}

function ruleLength(rule: Ability): number {
  // A rule's name and the space around it cost about a line.
  return rule.name.length + stripTags(rule.html).length + 60;
}

function sectionLength(section: RulesSection): number {
  return 80 + section.rules.reduce((sum, rule) => sum + ruleLength(rule), 0);
}

/**
 * A section too long for one page (a detachment with very long rules, many
 * enhancements) breaks between its rules, carrying on under its title,
 * "continued", on the next page.
 */
export function splitSections(sections: RulesSection[], budget: number): RulesSection[] {
  return sections.flatMap((section) => {
    if (sectionLength(section) <= budget) return [section];
    const parts: RulesSection[] = [];
    let rules: RulesSection["rules"] = [];
    let length = 80;
    for (const rule of section.rules) {
      if (rules.length && length + ruleLength(rule) > budget) {
        parts.push({ title: section.title, rules });
        rules = [];
        length = 80;
      }
      rules.push(rule);
      length += ruleLength(rule);
    }
    if (rules.length) parts.push({ title: section.title, rules });
    return parts.map((part, index) =>
      index ? { ...part, title: `${section.title}, continued` } : part,
    );
  });
}
