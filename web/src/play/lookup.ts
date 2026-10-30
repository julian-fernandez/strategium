import { ruleKey } from "../../../shared/bundle";
import { unitLabel } from "../../../shared/labels";
import { stripTags } from "../../../shared/markup";
import type { Ability, Army, Datasheet, Stratagem } from "../../../shared/types";
import type { PlayEntry } from "./playOrder";

/** One rule the army uses, where it comes from, and which units have it. */
export type RuleEntry = {
  key: string;
  name: string;
  html: string;
  /** "Army rule", a detachment's name, "Enhancement", "Core ability", "Ability"… */
  source: string;
  unitIds: string[];
};

/**
 * Every rule the army uses, alphabetically: the army rule, detachment rules,
 * enhancements taken, the core abilities, faction rules and weapon keywords
 * its cards name, and each unit's own abilities. An ability several units
 * share, word for word, is one entry naming all of them.
 */
export function armyRuleIndex(army: Army): RuleEntry[] {
  const entries = new Map<string, RuleEntry>();
  const add = (rule: Ability, source: string, unitIds: string[] = []) => {
    if (!rule.html) return;
    const key = `${ruleKey(rule.name)}|${rule.html}`;
    const known = entries.get(key);
    if (known) known.unitIds.push(...unitIds.filter((id) => !known.unitIds.includes(id)));
    else entries.set(key, { key, name: rule.name, html: rule.html, source, unitIds });
  };

  const { rules, detachments, enhancements } = army.armyRules;
  for (const rule of rules) add(rule, "Army rule");
  for (const detachment of detachments) {
    for (const rule of detachment.rules) add(rule, detachment.name);
  }
  for (const enhancement of enhancements) {
    const bearers = army.units.filter((unit) => unit.enhancement?.name === enhancement.name);
    add(
      enhancement,
      "Enhancement",
      bearers.map((unit) => unit.id),
    );
  }

  // The army rule is in the glossary too; it keeps its place as the army rule.
  const armyRuleKeys = new Set(rules.map((rule) => ruleKey(rule.name)));
  for (const rule of army.glossary) {
    const key = ruleKey(rule.name);
    if (armyRuleKeys.has(key)) continue;
    const named = (names: (unit: Datasheet) => string[]) =>
      army.units.filter((unit) => names(unit).some((name) => ruleKey(name) === key));
    const core = named((unit) => unit.coreAbilities);
    const faction = named((unit) => unit.factionAbilities);
    const weapons = named((unit) =>
      [...unit.ranged, ...unit.melee].flatMap((row) => row.profiles.flatMap((p) => p.keywords)),
    );
    const [source, units] = core.length
      ? ["Core ability", core]
      : weapons.length
        ? ["Weapon keyword", weapons]
        : faction.length
          ? ["Faction rule", faction]
          : ["Rule", []];
    add(
      rule,
      source,
      units.map((unit) => unit.id),
    );
  }

  for (const unit of army.units) {
    for (const ability of unit.abilities) add(ability, "Ability", [unit.id]);
    for (const ability of unit.wargearAbilities) add(ability, "Wargear ability", [unit.id]);
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Text as search compares it: lower case, no accents, curly quotes straightened, words split on anything else. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

/** Something to search, with its names (matched first) and its text, normalized once. */
export type Searchable<T> = { item: T; names: string[]; text: string };

export function searchable<T>(item: T, names: string[], html = ""): Searchable<T> {
  return { item, names: names.map(normalize), text: normalize(stripTags(html)) };
}

/**
 * The items that match a query, best first: a name that starts with it, then
 * a name with a word starting with each word typed ("bul sq" finds Bullgryn
 * Squad), then a name containing it, then the text. Spaces are optional, so
 * "reroll" finds "Re-roll". With no query, everything, in order.
 */
export function search<T>(list: Searchable<T>[], query: string): T[] {
  const typed = normalize(query);
  if (!typed) return list.map((entry) => entry.item);
  const words = typed.split(" ");
  const joined = typed.replace(/ /g, "");
  return list
    .map((entry, index) => ({ entry, index, score: score(entry, typed, words, joined) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((result) => result.entry.item);
}

function score(entry: Searchable<unknown>, typed: string, words: string[], joined: string): number {
  let best = 0;
  for (const name of entry.names) {
    const nameWords = name.split(" ");
    if (name.startsWith(typed)) return 4;
    if (words.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)))) best = 3;
    else if (best < 2 && name.replace(/ /g, "").includes(joined)) best = 2;
  }
  if (best) return best;
  return entry.text.replace(/ /g, "").includes(joined) ? 1 : 0;
}

/** Units by their label ("Bullgryn Squad #2"), any character leading them, and their models. */
export function searchableUnits(
  entries: PlayEntry[],
  numbers: Map<string, number>,
): Searchable<PlayEntry>[] {
  return entries.map((entry) =>
    searchable(entry, [
      unitLabel(entry.unit, numbers),
      ...entry.characters.map((character) => unitLabel(character, numbers)),
      ...[entry.unit, ...entry.characters].flatMap((sheet) => sheet.models.map((m) => m.name)),
    ]),
  );
}

export function searchableStratagems(stratagems: Stratagem[]): Searchable<Stratagem>[] {
  return stratagems.map((stratagem) => searchable(stratagem, [stratagem.name], stratagem.html));
}

export function searchableRules(rules: RuleEntry[]): Searchable<RuleEntry>[] {
  return rules.map((rule) => searchable(rule, [rule.name], rule.html));
}
