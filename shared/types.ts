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
  points: number;
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

export type Army = {
  note?: string;
  faction: string;
  detachments: string[];
  disposition?: string;
  battleSize?: BattleSize;
  units: Datasheet[];
  groups: AttachedGroup[];
  stratagems: Stratagem[];
  crossCheck: CrossCheckIssue[];
  warnings: string[];
  data: DataVersions;
};
