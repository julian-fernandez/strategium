/** What the server sends the web app: one army, ready to render as cards. */

export type WeaponProfile = {
  name: string;
  range: string;
  attacks: string;
  /** BS for ranged weapons, WS for melee weapons. */
  skill: string;
  strength: string;
  ap: string;
  damage: string;
  keywords: string[];
};

/** One weapon a unit carries. Several profiles render as the official `➤` rows. */
export type WeaponRow = {
  name: string;
  count: number;
  profiles: WeaponProfile[];
  /** The squad leader's own weapon: who carries it ("Superior"), when no one else does. */
  carrier?: string;
  /** The option it comes from, by normalized name. */
  key?: string;
};

/** A number of one piece of wargear, as BSData names it. */
export type Counted = { name: string; count: number };

/**
 * One model's change of wargear: what it gives up and what it takes. A
 * Dominion taking a meltagun becomes a "Dominion w/ Special Weapon", so a
 * swap can change the model's type too.
 */
export type Swap = {
  /** The model type making the change, and its label on the card ("Superior"). */
  model: string;
  modelLabel: string;
  /** The type it becomes, when that changes, and that type's label ("Special Weapon"). */
  toModel?: string;
  toLabel?: string;
  remove: Counted[];
  add: Counted[];
  /** What it's called in a menu: the choice's name, or what it adds. */
  label: string;
  /** The change in the unit's points. */
  cost: number;
  /** Why it can't be taken as the unit stands ("4 of 4 Dominion w/ Special Weapon"). */
  blocked?: string;
};

/**
 * One kind of model in a unit, as a player reads the squad: "Superior ×1",
 * "Dominion ×5", "Special Weapon 4 of 4". A trooper type with a special
 * weapon or a piece of wargear is a row of its own, labelled by it.
 */
export type LoadoutRow = {
  model: string;
  label: string;
  count: number;
  /** How many the unit may have, when that's limited. */
  max?: number;
  /** Wargear each of them carries that can't be changed. */
  fixed: Counted[];
  /** The choices they've made, each with what one of them could take instead. */
  picks: LoadoutPick[];
  /** How a trooper becomes one of these: one entry per choice it could come with. */
  joins: Swap[];
  /** Why no more can join, when the unit is full of them. */
  full?: string;
};

/** A choice some of a row's models have made ("Ministorum flamer", held by 4), or an empty optional slot. */
export type LoadoutPick = {
  /** The slot it fills ("Special Weapon"); empty for what sets a model type apart. */
  slot: string;
  /** The choice's name; empty for an optional slot nothing fills yet. */
  name: string;
  items: Counted[];
  count: number;
  swaps: Swap[];
};

/** A swap made to a unit of the list, kept so the list can be rebuilt with it. */
export type Edit = Pick<Swap, "model" | "toModel" | "remove" | "add"> & {
  /** The unit's place in the list. */
  unit: number;
  /** How many models make the same swap at once ("all 4"); one when missing. */
  times?: number;
};

export type StatLine = {
  name: string;
  m: string;
  t: string;
  sv: string;
  w: string;
  ld: string;
  oc: string;
  invSv?: string;
};

export type Ability = { name: string; html: string };

export type AttachmentRole = "leader" | "support" | "bodyguard";

export type Datasheet = {
  id: string;
  name: string;
  /** What the data prices the unit at, or what the list says when the data can't. */
  points: number;
  /** What the list says it costs. */
  listedPoints: number;
  /** False when BSData has a points rule the app can't read, so `points` may be off. */
  pointsExact: boolean;
  /** Each kind of model, what it carries and what it could change. */
  loadout: LoadoutRow[];
  models: { name: string; count: number }[];
  modelCount: number;
  stats: StatLine[];
  ranged: WeaponRow[];
  melee: WeaponRow[];
  coreAbilities: string[];
  factionAbilities: string[];
  abilities: Ability[];
  wargearAbilities: Ability[];
  enhancement?: Ability;
  isWarlord: boolean;
  /** The LEADER (or SUPPORT) box: which units this character can join. */
  attachTo?: { title: "Leader" | "Support"; html: string };
  keywords: string[];
  factionKeywords: string[];
  /** Background text from Wahapedia. */
  legend?: string;
  attachment?: { role: AttachmentRole; group: number };
  wahapediaId?: string;
  warnings: string[];
};

export type Stratagem = {
  id: string;
  name: string;
  cp: string;
  type: string;
  phase: string;
  turn: string;
  /** Empty for core stratagems. */
  detachment: string;
  html: string;
  /** The WHEN line as plain text, for compact lists. */
  when: string;
  /** Names of the units in this army that can use it. Empty when it targets no unit. */
  usableBy: string[];
  /** Every unit in the army can use it, so the card says so instead of listing them. */
  everyUnit: boolean;
};

export type AttachedGroup = {
  id: number;
  bodyguardId: string;
  characterIds: string[];
  /** Stratagems any member of the combined unit can use. */
  stratagemIds: string[];
};

export type BattleSize = { name: string; points: number; supported: boolean };

export type CrossCheckIssue = {
  unit: string;
  field: string;
  bsdata: string;
  wahapedia: string;
};

export type DataVersions = {
  bsdataSha?: string;
  bsdataDate?: string;
  wahapediaUpdate?: string;
  checkedAt?: string;
  changedAt?: string;
  lastError?: string;
};

/** What goes on the army rules card. */
export type ArmyRules = {
  /** Faction rules most of the army has, such as Acts of Faith. */
  rules: Ability[];
  detachments: { name: string; rules: Ability[] }[];
  enhancements: { name: string; cost: string; bearer: string; html: string }[];
};

/** Which exporter's format the list was read from, e.g. "New Recruit / GW app text". */
export type ListFormat = { id: string; label: string };

export type Army = {
  note?: string;
  faction: string;
  detachments: string[];
  disposition?: string;
  battleSize?: BattleSize;
  format?: ListFormat;
  units: Datasheet[];
  groups: AttachedGroup[];
  stratagems: Stratagem[];
  armyRules: ArmyRules;
  /** The text of every rule the army's cards name: core abilities, faction rules, weapon keywords. */
  glossary: Ability[];
  crossCheck: CrossCheckIssue[];
  warnings: string[];
  data: DataVersions;
};
