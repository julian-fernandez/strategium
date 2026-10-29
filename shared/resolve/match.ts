import { normalizeName } from "../bsdata/catalogues";
import type { FactionBundle, ItemData, ModelData, UnitData } from "../bundle";
import type { Ability } from "../types";
import { comparable } from "../wahapedia";

/**
 * A list's names against the data's, loosely. Exporters and BSData disagree
 * in small ways: "Scout" for "Scouts w/ Boltgun", "&" for "and", a trailing
 * "(Aura)", one weapon of a combined option ("Voidblade" for "Particle
 * caster and voidblade"). Exact names always win; looser forms are tried in turn.
 */

/** Lower case, "&" as "and", "w/" as "with", no parentheticals or punctuation, no trailing plural "s". */
export function looseName(name: string): string {
  return normalizeName(name)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\bw\/\s*/g, "with ")
    .replace(/[^\p{L}\p{N}' -]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?<=\p{L}{3})s$/u, "");
}

/** A model's name without its loadout: "Scouts w/ Boltgun" and "Scout" are both "scout". */
export function modelBase(name: string): string {
  return looseName(normalizeName(name).replace(/\s+(?:w\/|with)\s.*$/, ""));
}

export type ModelMatch = { key: string; model: ModelData; exact: boolean };

/**
 * The unit's model a list names. Several loadout variants can share a base
 * name ("Scout"); the one whose wargear covers the most of `items` wins, then
 * the unit's default model.
 */
export function matchModel(
  unit: UnitData,
  name: string,
  items: string[] = [],
): ModelMatch | undefined {
  const key = normalizeName(name);
  const exact = unit.models[key];
  if (exact) return { key, model: exact, exact: true };

  const loose = looseName(name);
  const base = modelBase(name);
  const candidates = Object.entries(unit.models).filter(([, model]) => {
    if (looseName(model.name) === loose) return true;
    const theirs = modelBase(model.name);
    // Same base, or one is the other plus a word ("Paragon" / "Paragon Warsuit",
    // "Canoptek Tomb Crawler" / "Tomb Crawler").
    return (
      theirs === base ||
      (theirs.length >= 3 && (base.endsWith(` ${theirs}`) || base.startsWith(`${theirs} `))) ||
      (base.length >= 3 && (theirs.endsWith(` ${base}`) || theirs.startsWith(`${base} `)))
    );
  });
  if (!candidates.length) {
    // Named after the unit itself ("Chaos Terminator" in Chaos Terminator Squad), where
    // BSData names the models by loadout only: the unit's default model.
    const unitBase = looseName(unit.name);
    const own = loose.length > 3 && (unitBase === loose || unitBase.startsWith(`${loose} `));
    const fallback = own && unit.defaultModel ? unit.models[unit.defaultModel] : undefined;
    return fallback && unit.defaultModel
      ? { key: unit.defaultModel, model: fallback, exact: false }
      : undefined;
  }

  const wanted = items.map(looseName);
  const score = ([, model]: [string, ModelData]) =>
    wanted.filter((item) => Object.values(model.items).some((i) => looseName(i.name) === item))
      .length;
  const best = Math.max(...candidates.map(score));
  const [bestKey, bestModel] =
    candidates.find((c) => score(c) === best && c[0] === unit.defaultModel) ??
    candidates.find((c) => score(c) === best) ??
    candidates[0] ??
    [];
  return bestKey && bestModel ? { key: bestKey, model: bestModel, exact: false } : undefined;
}

/** When every model in the unit has the same stat line, any of them gives the card its stats. */
export function soleModel(unit: UnitData): ModelMatch | undefined {
  const entries = Object.entries(unit.models);
  const lines = new Set(
    entries.flatMap(([, m]) => m.stats.map((s) => [s.m, s.t, s.sv, s.w, s.ld, s.oc].join("|"))),
  );
  if (lines.size > 1) return undefined;
  const [key, model] = entries.find(([k]) => k === unit.defaultModel) ?? entries[0] ?? [];
  return key && model ? { key, model, exact: false } : undefined;
}

export type ItemMatch = {
  key: string;
  item: ItemData;
  exact: boolean;
  /** Named by one of its parts: "Voidblade" for "Particle caster and voidblade". */
  part: boolean;
};

/** An option a list names, searched in each scope in turn (a model's own options, then the unit's). */
export function matchItem(
  scopes: (Record<string, ItemData> | undefined)[],
  name: string,
): ItemMatch | undefined {
  const key = normalizeName(name);
  for (const scope of scopes) {
    const item = scope?.[key];
    if (item) return { key, item, exact: true, part: false };
  }
  const loose = looseName(name);
  if (!loose) return undefined;
  const entries = scopes.flatMap((scope) => Object.entries(scope ?? {}));

  // Spacing and hyphens don't matter either: "Chain Fist" is "Chainfist", "Exoarmour" "Exo-armour".
  const compact = (value: string) => value.replace(/[\s-]/g, "");
  const same =
    entries.find(([, item]) => looseName(item.name) === loose) ??
    entries.find(([, item]) => compact(looseName(item.name)) === compact(loose));
  if (same) return { key: same[0], item: same[1], exact: false, part: false };

  const whole = entries.find(([, item]) => {
    const parts = item.name.split(/\s+(?:and|&|\+)\s+|,\s*/i);
    return parts.length > 1 && parts.some((part) => looseName(part) === loose);
  });
  if (whole) return { key: whole[0], item: whole[1], exact: false, part: true };

  // A weapon profile inside an option with another name ("Razor fan" in "Melee weapons").
  for (const [key, item] of entries) {
    for (const melee of [false, true]) {
      const profile = (melee ? item.melee : item.ranged).find(
        (p) => looseName(p.name.replace(/^➤\s*/, "")) === loose,
      );
      if (profile) {
        const only: ItemData = {
          name: profile.name,
          ranged: melee ? [] : [profile],
          melee: melee ? [profile] : [],
          abilities: [],
        };
        return {
          key: `${key}:${normalizeName(profile.name)}`,
          item: only,
          exact: false,
          part: false,
        };
      }
    }
  }

  // A longer or shorter form of the same name ("Transdimensional isolator").
  const close = entries.filter(([, item]) => {
    const theirs = looseName(item.name);
    const [short, long] = theirs.length < loose.length ? [theirs, loose] : [loose, theirs];
    return short.length >= 10 && long.endsWith(short);
  });
  const [only] = close;
  if (only && close.every(([key]) => key === only[0])) {
    return { key: only[0], item: only[1], exact: false, part: false };
  }
  return undefined;
}

/**
 * An enhancement by the name a list gives it ("Tools of Dominion (Upgrade)"):
 * the unit's own option first, then any detachment's enhancement on Wahapedia.
 */
export function matchEnhancement(
  bundle: FactionBundle,
  unit: UnitData,
  name: string,
): Ability | undefined {
  const option = matchItem([unit.items], name);
  const ability = option?.item.abilities[0];
  if (ability) return { name: ability.name, html: ability.html };
  // "Tools of Dominion (Upgrade)" and "The Thief of Secrets" name the same enhancements as without.
  const plain = (value: string) =>
    comparable(value.replace(/\s*\([^)]*\)\s*$/, "")).replace(/^the /, "");
  const wanted = plain(name);
  for (const detachment of bundle.detachments) {
    const found = detachment.enhancements.find((e) => plain(e.name) === wanted);
    if (found) return { name: found.name, html: found.html };
  }
  return undefined;
}
