import { z } from "zod";
import { normalizeName } from "./bsdata/catalogues";
import { parsePipeCsv } from "./csv";

/** The Wahapedia export files the app reads. */
export const WAHAPEDIA_FILES = [
  "Last_update",
  "Factions",
  "Detachments",
  "Detachment_abilities",
  "Enhancements",
  "Abilities",
  "Stratagems",
  "Datasheets",
  "Datasheets_stratagems",
  "Datasheets_models",
  "Datasheets_wargear",
  "Datasheets_abilities",
  "Datasheets_options",
  "Datasheets_models_cost",
  "Datasheets_keywords",
] as const;

export type WahapediaFile = (typeof WAHAPEDIA_FILES)[number];

/** Thrown when an upstream export no longer has the shape the compiler expects. */
export class UpstreamFormatError extends Error {
  override name = "UpstreamFormatError";
}

const text = z.string();

/** The columns the app relies on in each file. Extra columns are ignored. */
const COLUMNS = {
  Last_update: { last_update: text },
  Factions: { id: text, name: text },
  Detachments: { id: text, faction_id: text, name: text, type: text },
  Detachment_abilities: {
    id: text,
    faction_id: text,
    name: text,
    description: text,
    detachment_id: text,
  },
  Enhancements: {
    faction_id: text,
    name: text,
    id: text,
    cost: text,
    detachment_id: text,
    description: text,
  },
  Abilities: { id: text, name: text, faction_id: text, description: text },
  Stratagems: {
    faction_id: text,
    name: text,
    id: text,
    type: text,
    cp_cost: text,
    turn: text,
    phase: text,
    detachment: text,
    detachment_id: text,
    description: text,
  },
  Datasheets: { id: text, name: text, faction_id: text, legend: text },
  Datasheets_stratagems: { datasheet_id: text, stratagem_id: text },
  Datasheets_models: {
    datasheet_id: text,
    name: text,
    M: text,
    T: text,
    Sv: text,
    inv_sv: text,
    W: text,
    Ld: text,
    OC: text,
  },
  Datasheets_wargear: {
    datasheet_id: text,
    name: text,
    description: text,
    range: text,
    type: text,
    A: text,
    BS_WS: text,
    S: text,
    AP: text,
    D: text,
  },
  Datasheets_abilities: { datasheet_id: text, name: text, description: text, type: text },
  Datasheets_options: { datasheet_id: text, line: text, button: text, description: text },
  Datasheets_models_cost: { datasheet_id: text, line: text, description: text, cost: text },
  Datasheets_keywords: { datasheet_id: text, keyword: text, model: text, is_faction_keyword: text },
} satisfies Record<WahapediaFile, z.ZodRawShape>;

/** Every column the app reads is text. */
type Row<F extends WahapediaFile> = Record<keyof (typeof COLUMNS)[F] & string, string>;

/** Parses one export file and checks it still has every column the app reads. */
export function wahapediaTable<F extends WahapediaFile>(file: F, source: string): Row<F>[] {
  const rows = parsePipeCsv(source);
  const shape = COLUMNS[file];
  const first = rows[0];
  if (!first) throw new UpstreamFormatError(`Wahapedia ${file}.csv is empty.`);
  const missing = Object.keys(shape).filter((column) => !(column in first));
  if (missing.length) {
    throw new UpstreamFormatError(
      `Wahapedia ${file}.csv no longer has the column(s) ${missing.join(", ")}; the export format changed.`,
    );
  }
  const schema = z.object(shape);
  return rows.map((row) => schema.parse(row) as unknown as Row<F>);
}

export type WahapediaStratagem = {
  id: string;
  factionId: string;
  name: string;
  type: string;
  cp: string;
  turn: string;
  phase: string;
  detachment: string;
  detachmentId: string;
  description: string;
};

export type WahapediaDatasheet = { id: string; name: string; factionId: string; legend: string };

export type WahapediaModel = {
  name: string;
  m: string;
  t: string;
  sv: string;
  invSv: string;
  w: string;
  ld: string;
  oc: string;
};

export type WahapediaWeapon = {
  name: string;
  /** Its keywords as Wahapedia writes them: "anti-psyker 4+, devastating wounds, pistol". */
  keywords: string;
  type: string;
  range: string;
  attacks: string;
  skill: string;
  strength: string;
  ap: string;
  damage: string;
};

export type Wahapedia = {
  lastUpdate: string;
  factions: { id: string; name: string }[];
  detachments: { id: string; factionId: string; name: string; type: string }[];
  detachmentRules: { detachmentId: string; name: string; description: string }[];
  enhancements: {
    factionId: string;
    detachmentId: string;
    name: string;
    cost: string;
    description: string;
  }[];
  /** Faction and core abilities, by id. */
  abilities: { id: string; name: string; factionId: string; description: string }[];
  stratagems: WahapediaStratagem[];
  datasheets: WahapediaDatasheet[];
  /** datasheet id -> stratagem ids that datasheet can use. */
  datasheetStratagems: Map<string, Set<string>>;
  /** Stratagems that at least one datasheet can use. The rest target no unit. */
  unitStratagems: Set<string>;
  models: Map<string, WahapediaModel[]>;
  wargear: Map<string, WahapediaWeapon[]>;
  /**
   * datasheet id -> the rules written out on that datasheet alone, with their
   * text: its weapons' own ("Conversion", "Linked Fire") and a few it names
   * among its abilities ("Supreme Commander").
   */
  datasheetRules: Map<string, { name: string; description: string }[]>;
  /**
   * datasheet id -> its wargear options, in order, as Wahapedia writes them
   * ("The Sister Superior's boltgun can be replaced with…"). A footnote starts with "*".
   */
  options: Map<string, string[]>;
  /**
   * datasheet id -> its points lines, in order: section headings with no cost
   * ("YOUR UNIT COSTS", "YOUR 3RD+ UNIT COSTS", "WARGEAR OPTIONS") and the
   * prices under them ("10 models" 115, "per Multi-melta" 10).
   */
  costs: Map<string, { description: string; cost: string }[]>;
  /** datasheet id -> its keywords; a model's own name the model it's on. */
  keywords: Map<string, { keyword: string; model: string; faction: boolean }[]>;
};

export function buildWahapedia(files: Record<WahapediaFile, string>): Wahapedia {
  const datasheetStratagems = new Map<string, Set<string>>();
  const unitStratagems = new Set<string>();
  for (const row of wahapediaTable("Datasheets_stratagems", files.Datasheets_stratagems)) {
    const set = datasheetStratagems.get(row.datasheet_id) ?? new Set<string>();
    set.add(row.stratagem_id);
    datasheetStratagems.set(row.datasheet_id, set);
    unitStratagems.add(row.stratagem_id);
  }

  const models = new Map<string, WahapediaModel[]>();
  for (const row of wahapediaTable("Datasheets_models", files.Datasheets_models)) {
    const list = models.get(row.datasheet_id) ?? [];
    list.push({
      name: row.name,
      m: row.M,
      t: row.T,
      sv: row.Sv,
      invSv: row.inv_sv,
      w: row.W,
      ld: row.Ld,
      oc: row.OC,
    });
    models.set(row.datasheet_id, list);
  }

  const wargear = new Map<string, WahapediaWeapon[]>();
  for (const row of wahapediaTable("Datasheets_wargear", files.Datasheets_wargear)) {
    const list = wargear.get(row.datasheet_id) ?? [];
    list.push({
      name: row.name,
      keywords: row.description,
      type: row.type,
      range: row.range,
      attacks: row.A,
      skill: row.BS_WS,
      strength: row.S,
      ap: row.AP,
      damage: row.D,
    });
    wargear.set(row.datasheet_id, list);
  }

  // Rows that only point at a shared ability (by ability_id) have no name or text of their own.
  const datasheetRules = new Map<string, { name: string; description: string }[]>();
  for (const row of wahapediaTable("Datasheets_abilities", files.Datasheets_abilities)) {
    if (!row.name || !row.description) continue;
    const list = datasheetRules.get(row.datasheet_id) ?? [];
    list.push({ name: row.name, description: row.description });
    datasheetRules.set(row.datasheet_id, list);
  }

  const optionLines = new Map<string, { line: number; description: string }[]>();
  for (const row of wahapediaTable("Datasheets_options", files.Datasheets_options)) {
    if (!row.description) continue;
    const list = optionLines.get(row.datasheet_id) ?? [];
    list.push({ line: Number(row.line) || 0, description: row.description });
    optionLines.set(row.datasheet_id, list);
  }
  const options = new Map(
    [...optionLines].map(([id, lines]) => [
      id,
      lines.sort((a, b) => a.line - b.line).map((line) => line.description),
    ]),
  );

  const costLines = new Map<string, { line: number; description: string; cost: string }[]>();
  for (const row of wahapediaTable("Datasheets_models_cost", files.Datasheets_models_cost)) {
    const list = costLines.get(row.datasheet_id) ?? [];
    list.push({ line: Number(row.line) || 0, description: row.description, cost: row.cost });
    costLines.set(row.datasheet_id, list);
  }
  const costs = new Map(
    [...costLines].map(([id, lines]) => [
      id,
      lines.sort((a, b) => a.line - b.line).map(({ description, cost }) => ({ description, cost })),
    ]),
  );

  const keywords = new Map<string, { keyword: string; model: string; faction: boolean }[]>();
  for (const row of wahapediaTable("Datasheets_keywords", files.Datasheets_keywords)) {
    const list = keywords.get(row.datasheet_id) ?? [];
    list.push({
      keyword: row.keyword,
      model: row.model,
      faction: row.is_faction_keyword === "true",
    });
    keywords.set(row.datasheet_id, list);
  }

  const abilityIds = new Set<string>();
  const abilities = wahapediaTable("Abilities", files.Abilities)
    .filter((row) => !abilityIds.has(row.id) && abilityIds.add(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      factionId: row.faction_id,
      description: row.description,
    }));

  return {
    lastUpdate: wahapediaTable("Last_update", files.Last_update)[0]?.last_update ?? "",
    factions: wahapediaTable("Factions", files.Factions).map((row) => ({
      id: row.id,
      name: row.name,
    })),
    detachments: wahapediaTable("Detachments", files.Detachments).map((row) => ({
      id: row.id,
      factionId: row.faction_id,
      name: row.name,
      type: row.type,
    })),
    detachmentRules: wahapediaTable("Detachment_abilities", files.Detachment_abilities).map(
      (row) => ({ detachmentId: row.detachment_id, name: row.name, description: row.description }),
    ),
    enhancements: wahapediaTable("Enhancements", files.Enhancements).map((row) => ({
      factionId: row.faction_id,
      detachmentId: row.detachment_id,
      name: row.name,
      cost: row.cost,
      description: row.description,
    })),
    abilities,
    stratagems: wahapediaTable("Stratagems", files.Stratagems).map((row) => ({
      id: row.id,
      factionId: row.faction_id,
      name: row.name,
      type: row.type,
      cp: row.cp_cost,
      turn: row.turn,
      phase: row.phase,
      detachment: row.detachment,
      detachmentId: row.detachment_id,
      description: row.description,
    })),
    datasheets: wahapediaTable("Datasheets", files.Datasheets).map((row) => ({
      id: row.id,
      name: row.name,
      factionId: row.faction_id,
      legend: row.legend,
    })),
    datasheetStratagems,
    unitStratagems,
    models,
    wargear,
    datasheetRules,
    options,
    costs,
    keywords,
  };
}

export function findFaction(
  data: Wahapedia,
  name: string,
): { id: string; name: string } | undefined {
  return data.factions.find((faction) => normalizeName(faction.name) === normalizeName(name));
}

/** A list's unit, matched to a Wahapedia datasheet: same faction first, then any faction. */
export function findDatasheet(
  data: Wahapedia,
  name: string,
  factionId: string | undefined,
): WahapediaDatasheet | undefined {
  const key = comparable(name);
  const matches = data.datasheets.filter((sheet) => comparable(sheet.name) === key);
  return matches.find((sheet) => sheet.factionId === factionId) ?? matches[0];
}

/** Names compared loosely: case, apostrophes, hyphens and a trailing `[Legends]` don't matter. */
export function comparable(name: string): string {
  return normalizeName(name)
    .replace(/\s*\[legends\]$/, "")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ");
}
