import { stripTags } from "../../../shared/markup";
import type { Ability, Army, AttachedGroup, Datasheet, Stratagem } from "../../../shared/types";

export type DeckOptions = {
  /** Print leaders and supports right after the unit they join, the first on its back. */
  leadersOnBack: boolean;
  /**
   * Print double-sided: every card gets a back, so each stays on its own sheet.
   * A unit without a leader gets its own stratagems there.
   */
  duplex: boolean;
  stratagems: boolean;
  /** "Paragon Warsuits #1, #2, #3" for units that share a name. */
  numberDuplicates: boolean;
  /** A first card with the army rule, the detachment rules and the enhancements taken. */
  armyRules: boolean;
  /** Reference pages at the end with every core ability and weapon keyword the cards name. */
  glossary: boolean;
};

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  leadersOnBack: true,
  duplex: true,
  stratagems: true,
  numberDuplicates: true,
  armyRules: true,
  glossary: true,
};

/** A titled run of rules on the army rules card: the army rule, one detachment, the enhancements. */
export type RulesSection = { title: string; rules: (Ability & { note?: string })[] };

export type DeckPage =
  | { kind: "datasheet"; key: string; unit: Datasheet }
  /** Stratagems for one unit, or for an attached unit and its characters. */
  | {
      kind: "unit-back";
      key: string;
      unit: Datasheet;
      characters?: Datasheet[];
      stratagems: Stratagem[];
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
 * The print order: the army rules card, each datasheet followed by its back,
 * the stratagem deck, then the rules reference. Every unit, characters
 * included, prints on the same full datasheet. An attached unit's characters
 * follow it (the first on its back), then a card with the stratagems the
 * attached unit can use. A lone unit's back holds (double-sided only) its own
 * stratagems, or is left blank when there's nothing to put on it.
 */
export function buildDeck(army: Army, options: DeckOptions): DeckPage[] {
  const pages: DeckPage[] = [];
  const byId = new Map(army.units.map((unit) => [unit.id, unit]));
  const groupFor = (unit: Datasheet): AttachedGroup | undefined =>
    army.groups.find((group) => group.bodyguardId === unit.id && group.characterIds.length > 0);
  const onBack = new Set(
    options.leadersOnBack
      ? army.groups.filter((g) => g.bodyguardId).flatMap((g) => g.characterIds)
      : [],
  );

  const pushBlank = (key: string) => {
    if (options.duplex) pages.push({ kind: "blank", key: `blank-${key}` });
  };

  if (options.armyRules) {
    const parts = paginate(armyRulesSections(army), sectionLength, ARMY_RULES_BUDGET);
    parts.forEach((sections, index) => {
      const key = `army-rules-${index}`;
      pages.push({ kind: "army-rules", key, sections, part: index + 1, parts: parts.length });
      pushBlank(key);
    });
  }

  for (const unit of army.units) {
    if (onBack.has(unit.id)) continue;
    pages.push({ kind: "datasheet", key: unit.id, unit });

    const group = options.leadersOnBack ? groupFor(unit) : undefined;
    if (group) {
      const characters = group.characterIds
        .map((id) => byId.get(id))
        .filter((c): c is Datasheet => Boolean(c));
      for (const character of characters) {
        pages.push({ kind: "datasheet", key: character.id, unit: character });
      }
      const stratagems = army.stratagems.filter((s) => group.stratagemIds.includes(s.id));
      if (stratagems.length) {
        pages.push({
          kind: "unit-back",
          key: `unit-back-${unit.id}`,
          unit,
          characters,
          stratagems,
        });
      }
      // Double-sided, the group ends on a back so the next unit starts on a front.
      if ((1 + characters.length + (stratagems.length ? 1 : 0)) % 2) pushBlank(unit.id);
      continue;
    }

    const own = army.stratagems.filter((s) => s.usableBy.includes(unit.name));
    if (options.duplex && own.length) {
      pages.push({ kind: "unit-back", key: `unit-back-${unit.id}`, unit, stratagems: own });
    } else {
      pushBlank(unit.id);
    }
  }

  if (options.stratagems) {
    for (let i = 0; i < army.stratagems.length; i += STRATAGEMS_PER_PAGE) {
      const key = `stratagems-${i}`;
      pages.push({
        kind: "stratagems",
        key,
        stratagems: army.stratagems.slice(i, i + STRATAGEMS_PER_PAGE),
      });
      pushBlank(key);
    }
  }

  if (options.glossary) {
    // Rules the army rules card prints in full (Acts of Faith) aren't repeated.
    const onArmyCard = new Set(options.armyRules ? army.armyRules.rules.map((r) => r.name) : []);
    const rules = army.glossary.filter((rule) => !onArmyCard.has(rule.name));
    // Reference pages are read as a booklet, so double-sided they back onto each other.
    const parts = paginate(rules, ruleLength, GLOSSARY_BUDGET);
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
              note: [e.bearer, e.cost ? `${e.cost} pts` : ""].filter(Boolean).join(" · "),
            })),
          },
        ]
      : []),
  ];
}

/**
 * Packs items into pages in order, starting a new page when the next item
 * would take the page past `budget`. An item bigger than a page gets one to itself.
 */
export function paginate<T>(items: T[], size: (item: T) => number, budget: number): T[][] {
  const pages: T[][] = [];
  let page: T[] = [];
  let used = 0;
  for (const item of items) {
    const length = size(item);
    if (page.length && used + length > budget) {
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
