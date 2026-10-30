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
