import { z } from "zod";

/**
 * A faction bundle: everything needed to turn a list for one faction into
 * cards, compiled from BSData and Wahapedia at sync time. Armies are built
 * from it in the browser, so the raw sources never leave the server.
 *
 * Bump COMPILER_VERSION whenever the shape or the compile rules change, so
 * cached bundles are rebuilt.
 */
export const COMPILER_VERSION = 13;

export const weaponProfileSchema = z.object({
  name: z.string(),
  range: z.string(),
  attacks: z.string(),
  skill: z.string(),
  strength: z.string(),
  ap: z.string(),
  damage: z.string(),
  keywords: z.array(z.string()),
});

export const statLineSchema = z.object({
  name: z.string(),
  m: z.string(),
  t: z.string(),
  sv: z.string(),
  w: z.string(),
  ld: z.string(),
  oc: z.string(),
  invSv: z.string().optional(),
});

export const abilitySchema = z.object({ name: z.string(), html: z.string() });

export const profileFieldSchema = z.enum([
  "range",
  "attacks",
  "skill",
  "strength",
  "ap",
  "damage",
  "keywords",
  "m",
  "t",
  "sv",
  "w",
  "ld",
  "oc",
  "invSv",
]);

export const modifierOpSchema = z.enum(["set", "append", "increment", "decrement"]);

/**
 * A profile change that applies only when the list takes a given selection
 * (an upgrade, a piece of wargear). Unconditional changes, and ones that only
 * depend on which unit this is, are applied at compile time instead.
 */
export const modifierSchema = z.object({
  /** Normalized name of the selection that switches it on. */
  when: z.string(),
  /** Weapon or model profile it changes, by name. */
  profile: z.string(),
  field: profileFieldSchema,
  op: modifierOpSchema,
  value: z.string(),
});

/** One option a unit can take: a weapon, a piece of wargear, an enhancement. */
export const itemSchema = z.object({
  name: z.string(),
  ranged: z.array(weaponProfileSchema),
  melee: z.array(weaponProfileSchema),
  abilities: z.array(abilitySchema),
});

export const countedSchema = z.object({ name: z.string(), count: z.number() });

export const modelSchema = z.object({
  name: z.string(),
  stats: z.array(statLineSchema),
  keywords: z.array(z.string()),
  factionKeywords: z.array(z.string()),
  /** Options under this model, by normalized name. Looked up before the unit's. */
  items: z.record(z.string(), itemSchema),
  /** How many of this model a unit must and may have. */
  min: z.number(),
  max: z.number(),
  /**
   * What one of these models carries when a list doesn't say: wargear it must
   * take and each choice's default. For formats that leave wargear out.
   */
  defaults: z.array(countedSchema),
  /** Points for each one of these models, on top of the unit's. */
  cost: z.number(),
});

/** A count in a points rule: the unit's models, some model types (a squad group's), or one option. */
export const pointsCountSchema = z.object({
  compare: z.enum(["atLeast", "greaterThan", "atMost", "lessThan", "equalTo", "notEqualTo"]),
  value: z.number(),
  /** Model types by normalized name, counted together; with neither this nor `item`, every model. */
  models: z.array(z.string()).optional(),
  /** An option by normalized name. */
  item: z.string().optional(),
});

/**
 * A unit's points: its base cost, the rules that change it by squad size
 * (applied in order, each when all of its counts hold), and what a copy costs
 * extra once the army already has `after` of the same datasheet before it.
 * `exact` is false when BSData had a rule this can't read.
 */
export const pointsSchema = z.object({
  base: z.number(),
  rules: z.array(
    z.object({
      op: z.enum(["set", "increment", "decrement", "multiply"]),
      value: z.number(),
      when: z.array(pointsCountSchema),
    }),
  ),
  repeat: z.object({ after: z.number(), value: z.number() }).optional(),
  exact: z.boolean(),
});

export const crossCheckIssueSchema = z.object({
  unit: z.string(),
  field: z.string(),
  bsdata: z.string(),
  wahapedia: z.string(),
});

export const unitSchema = z.object({
  name: z.string(),
  stats: z.array(statLineSchema),
  abilities: z.array(abilitySchema),
  attachTo: z.object({ title: z.enum(["Leader", "Support"]), html: z.string() }).optional(),
  coreRules: z.array(z.string()),
  factionRules: z.array(z.string()),
  keywords: z.array(z.string()),
  factionKeywords: z.array(z.string()),
  /** Model types, by normalized name. A single-model unit has itself here. */
  models: z.record(z.string(), modelSchema),
  /** Every option anywhere in the unit, by normalized name; first one found wins. */
  items: z.record(z.string(), itemSchema),
  /** The model that makes up the numbers (the trooper, not the sergeant), by normalized name. */
  defaultModel: z.string().optional(),
  points: pointsSchema,
  /** Points for one of each option that costs any (wargear, enhancements), by normalized name. */
  costs: z.record(z.string(), z.number()),
  /**
   * Official weapon names (Wahapedia's, which the official app's lists use)
   * that BSData spells or names differently, each to the BSData option with
   * the same profile: "master-crafted power sword" to "master-crafted power weapon".
   */
  aliases: z.record(z.string(), z.string()),
  modifiers: z.array(modifierSchema),
  wahapedia: z
    .object({ id: z.string(), legend: z.string(), stratagemIds: z.array(z.string()) })
    .optional(),
  /** Where BSData's numbers for this unit differ from Wahapedia's. */
  crossCheck: z.array(crossCheckIssueSchema),
});

export const stratagemSchema = z.object({
  id: z.string(),
  name: z.string(),
  cp: z.string(),
  type: z.string(),
  phase: z.string(),
  turn: z.string(),
  /** Empty for core stratagems. */
  detachment: z.string(),
  detachmentId: z.string(),
  html: z.string(),
  when: z.string(),
  /** False for stratagems that target no unit, like New Orders. */
  targetsUnits: z.boolean(),
});

export const detachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rules: z.array(abilitySchema),
  enhancements: z.array(z.object({ name: z.string(), cost: z.string(), html: z.string() })),
});

export const factionBundleSchema = z.object({
  compilerVersion: z.literal(COMPILER_VERSION),
  /** The faction as a list names it, e.g. "Adepta Sororitas". */
  faction: z.string(),
  catalogue: z.string(),
  wahapediaFactionId: z.string().optional(),
  sources: z.object({ bsdataSha: z.string(), wahapediaUpdate: z.string() }),
  /** Units by normalized name. */
  units: z.record(z.string(), unitSchema),
  detachments: z.array(detachmentSchema),
  stratagems: z.array(stratagemSchema),
  /** Rules text by rule key (see `ruleKey`): core abilities, faction rules, weapon keywords. */
  rules: z.record(z.string(), abilitySchema),
});

export type WeaponProfileData = z.infer<typeof weaponProfileSchema>;
export type ItemData = z.infer<typeof itemSchema>;
export type ModelData = z.infer<typeof modelSchema>;
export type Counted = z.infer<typeof countedSchema>;
export type PointsData = z.infer<typeof pointsSchema>;
export type PointsCount = z.infer<typeof pointsCountSchema>;
export type UnitData = z.infer<typeof unitSchema>;
export type ModifierData = z.infer<typeof modifierSchema>;
export type ProfileField = z.infer<typeof profileFieldSchema>;
export type ModifierOp = z.infer<typeof modifierOpSchema>;
export type StratagemData = z.infer<typeof stratagemSchema>;
export type FactionBundle = z.infer<typeof factionBundleSchema>;

/**
 * The key a rule is filed under, so "Feel No Pain 5+", "Melta 2",
 * "Anti-PSYKER 4+" and "Sustained Hits 1" find "Feel No Pain", "Melta",
 * "Anti" and "Sustained Hits".
 */
export function ruleKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^anti-.*$/, "anti")
    .replace(/[’']/g, "'")
    .replace(/\s+(?:\d+\+?\*?|d\d+(?:\+\d+)?|\d*d\d+|\d+"|x\d+)$/i, "")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
