import { z } from "zod";
import { normalizeName } from "./bsdata/catalogues";
import {
  type FactionBundle,
  type PointsData,
  statLineSchema,
  type UnitData,
  unitSchema,
  weaponProfileSchema,
} from "./bundle";

/**
 * Corrections laid over the compiled data, kept private (data/overrides/, never
 * committed): since GW's takedown of BSData its data is frozen at 11 November
 * 2026, so later points changes, errata and new units come in this way.
 * One file per faction, named after its bundle ("imperium-adepta-sororitas.json").
 *
 *   {
 *     "source": "Munitorum Field Manual, 2026-12",
 *     "units": {
 *       "Celestian Insidiants": { "points": { "10": 120 } },
 *       "Retributor Squad": { "weapons": { "Heavy bolter": { "attacks": "4" } } }
 *     },
 *     "enhancements": { "Saintly Example": 15 }
 *   }
 */
export const unitOverrideSchema = z
  .object({
    /** Gone from the game, or folded into another datasheet. */
    remove: z.boolean().optional(),
    /** Points by squad size, the way the points lists give them: { "5": 60, "10": 120 }. */
    points: z.record(z.string().regex(/^\d+$/), z.number().int().nonnegative()).optional(),
    /** What a copy costs extra once the army has `after` of it already, or null for nothing. */
    repeat: z
      .object({ after: z.number().int().positive(), value: z.number().int().nonnegative() })
      .nullable()
      .optional(),
    /** What one option costs, by its name: { "Multi-melta": 10 }. */
    costs: z.record(z.string(), z.number().int().nonnegative()).optional(),
    /** Stat line changes, by the line's name: { "Celestian Insidiant": { "oc": "2" } }. */
    stats: z.record(z.string(), statLineSchema.omit({ name: true }).partial()).optional(),
    /** Weapon profile changes, by the profile's name, wherever the unit has it. */
    weapons: z.record(z.string(), weaponProfileSchema.omit({ name: true }).partial()).optional(),
    keywords: z
      .object({ add: z.array(z.string()).optional(), remove: z.array(z.string()).optional() })
      .optional(),
    /** Abilities by name: their new text (HTML), or null to drop one. */
    abilities: z.record(z.string(), z.string().nullable()).optional(),
  })
  .strict();

export const overridesSchema = z
  .object({
    /** Where the changes come from: a points list, a dataslate, a link. */
    source: z.string().optional(),
    /** Changes to units the data has, by the unit's name as the data names it. */
    units: z.record(z.string(), unitOverrideSchema).default({}),
    /** Units the data doesn't have yet, written out in full. */
    addUnits: z.array(unitSchema).default([]),
    /** Enhancement costs, by name. */
    enhancements: z.record(z.string(), z.number().int().nonnegative()).default({}),
  })
  .strict();

export type UnitOverride = z.infer<typeof unitOverrideSchema>;
export type Overrides = z.infer<typeof overridesSchema>;

/**
 * The bundle with its overrides applied, and the units they changed (by key),
 * so their cross-check can be worked out again. Each change must find what it
 * changes: a unit, stat line, weapon, ability or enhancement the data doesn't
 * have is an error, so a mistyped name never passes silently.
 */
export function applyOverrides(
  bundle: FactionBundle,
  overrides: Overrides,
): { bundle: FactionBundle; changed: string[] } {
  const result = structuredClone(bundle);
  const changed: string[] = [];
  const problems: string[] = [];

  for (const [name, override] of Object.entries(overrides.units)) {
    const key = normalizeName(name);
    const unit = result.units[key];
    if (!unit) {
      problems.push(`no unit named "${name}"`);
      continue;
    }
    if (override.remove) {
      delete result.units[key];
      continue;
    }
    problems.push(...applyToUnit(unit, override).map((problem) => `${name}: ${problem}`));
    changed.push(key);
  }

  for (const unit of overrides.addUnits) {
    result.units[normalizeName(unit.name)] = structuredClone(unit);
    changed.push(normalizeName(unit.name));
  }

  for (const [name, cost] of Object.entries(overrides.enhancements)) {
    const key = plainName(name);
    let found = false;
    for (const detachment of result.detachments) {
      for (const enhancement of detachment.enhancements) {
        if (plainName(enhancement.name) !== key) continue;
        enhancement.cost = String(cost);
        found = true;
      }
    }
    // BSData prices an enhancement on each character that can take it, and that price wins.
    for (const unit of Object.values(result.units)) {
      for (const costKey of Object.keys(unit.costs)) {
        if (plainName(costKey) === key) unit.costs[costKey] = cost;
      }
    }
    if (!found) problems.push(`no enhancement named "${name}"`);
  }

  if (problems.length) {
    throw new Error(
      `Overrides for ${bundle.faction} don't match the data: ${problems.join("; ")}.`,
    );
  }
  return { bundle: result, changed };
}

/** One unit's changes, in place; what it couldn't find, as problems. */
function applyToUnit(unit: UnitData, override: UnitOverride): string[] {
  const problems: string[] = [];
  if (override.points) {
    unit.points = pointsBySize(unit.points, override.points);
    // A price by size is the whole squad's, so nothing more for each model on top.
    for (const model of Object.values(unit.models)) model.cost = 0;
  }
  if (override.repeat !== undefined) {
    unit.points = { ...unit.points, repeat: override.repeat ?? undefined };
  }

  for (const [name, cost] of Object.entries(override.costs ?? {})) {
    const key = normalizeName(name);
    if (!(key in unit.costs) && !(key in unit.items)) problems.push(`no option named "${name}"`);
    unit.costs[key] = cost;
  }

  for (const [name, patch] of Object.entries(override.stats ?? {})) {
    const lines = [unit.stats, ...Object.values(unit.models).map((model) => model.stats)]
      .flat()
      .filter((line) => normalizeName(line.name) === normalizeName(name));
    if (!lines.length) problems.push(`no stat line named "${name}"`);
    for (const line of lines) Object.assign(line, patch);
  }

  for (const [name, patch] of Object.entries(override.weapons ?? {})) {
    const items = [
      ...Object.values(unit.items),
      ...Object.values(unit.models).flatMap((model) => Object.values(model.items)),
    ];
    const profiles = items
      .flatMap((item) => [...item.ranged, ...item.melee])
      .filter((profile) => normalizeName(profile.name) === normalizeName(name));
    if (!profiles.length) problems.push(`no weapon named "${name}"`);
    for (const profile of profiles) Object.assign(profile, patch);
  }

  const { add = [], remove = [] } = override.keywords ?? {};
  const dropped = new Set(remove.map((keyword) => keyword.toLowerCase()));
  const keep = (keywords: string[]) =>
    keywords.filter((keyword) => !dropped.has(keyword.toLowerCase()));
  unit.keywords = keep(unit.keywords);
  for (const model of Object.values(unit.models)) model.keywords = keep(model.keywords);
  for (const keyword of add) {
    if (!unit.keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      unit.keywords.push(keyword);
    }
  }

  for (const [name, html] of Object.entries(override.abilities ?? {})) {
    const index = unit.abilities.findIndex((a) => normalizeName(a.name) === normalizeName(name));
    if (html === null) {
      if (index < 0) problems.push(`no ability named "${name}"`);
      else unit.abilities.splice(index, 1);
    } else if (index < 0) {
      unit.abilities.push({ name, html });
    } else {
      unit.abilities[index] = { name: unit.abilities[index]?.name ?? name, html };
    }
  }
  return problems;
}

/**
 * Points by squad size as the unit's points: the smallest size's price, then
 * each larger size's from that size up. What a copy costs extra stays.
 */
export function pointsBySize(points: PointsData, bySize: Record<string, number>): PointsData {
  const sizes = Object.entries(bySize)
    .map(([size, cost]) => [Number(size), cost] as const)
    .sort(([a], [b]) => a - b);
  const [first, ...rest] = sizes;
  return {
    ...points,
    base: first?.[1] ?? points.base,
    rules: rest.map(([size, cost]) => ({
      op: "set" as const,
      value: cost,
      when: [{ compare: "atLeast" as const, value: size }],
    })),
    exact: true,
  };
}

/** An enhancement as both sources name it: "The Thief of Secrets (Upgrade)" is "thief of secrets". */
function plainName(name: string): string {
  return normalizeName(name)
    .replace(/\s*\([^)]*\)$/, "")
    .replace(/^the /, "");
}
