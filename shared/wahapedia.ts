import { normalizeName } from "./bsdata/catalogues";
import { parsePipeCsv } from "./csv";

/** The Wahapedia export files the app reads. */
export const WAHAPEDIA_FILES = [
  "Last_update",
  "Factions",
  "Detachments",
  "Stratagems",
  "Datasheets",
  "Datasheets_stratagems",
  "Datasheets_models",
  "Datasheets_wargear",
  "Datasheets_leader",
] as const;

export type WahapediaFile = (typeof WAHAPEDIA_FILES)[number];

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
  stratagems: WahapediaStratagem[];
  datasheets: WahapediaDatasheet[];
  /** datasheet id -> stratagem ids that datasheet can use. */
  datasheetStratagems: Map<string, Set<string>>;
  /** Stratagems that at least one datasheet can use. The rest target no unit. */
  unitStratagems: Set<string>;
  models: Map<string, WahapediaModel[]>;
  wargear: Map<string, WahapediaWeapon[]>;
};

export function buildWahapedia(files: Record<WahapediaFile, string>): Wahapedia {
  const datasheetStratagems = new Map<string, Set<string>>();
  const unitStratagems = new Set<string>();
  for (const row of parsePipeCsv(files.Datasheets_stratagems)) {
    const set = datasheetStratagems.get(row.datasheet_id ?? "") ?? new Set<string>();
    set.add(row.stratagem_id ?? "");
    datasheetStratagems.set(row.datasheet_id ?? "", set);
    unitStratagems.add(row.stratagem_id ?? "");
  }

  const models = new Map<string, WahapediaModel[]>();
  for (const row of parsePipeCsv(files.Datasheets_models)) {
    const list = models.get(row.datasheet_id ?? "") ?? [];
    list.push({
      name: row.name ?? "",
      m: row.M ?? "",
      t: row.T ?? "",
      sv: row.Sv ?? "",
      invSv: row.inv_sv ?? "",
      w: row.W ?? "",
      ld: row.Ld ?? "",
      oc: row.OC ?? "",
    });
    models.set(row.datasheet_id ?? "", list);
  }

  const wargear = new Map<string, WahapediaWeapon[]>();
  for (const row of parsePipeCsv(files.Datasheets_wargear)) {
    const list = wargear.get(row.datasheet_id ?? "") ?? [];
    list.push({
      name: row.name ?? "",
      type: row.type ?? "",
      range: row.range ?? "",
      attacks: row.A ?? "",
      skill: row.BS_WS ?? "",
      strength: row.S ?? "",
      ap: row.AP ?? "",
      damage: row.D ?? "",
    });
    wargear.set(row.datasheet_id ?? "", list);
  }

  return {
    lastUpdate: parsePipeCsv(files.Last_update)[0]?.last_update ?? "",
    factions: parsePipeCsv(files.Factions).map((row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
    })),
    detachments: parsePipeCsv(files.Detachments).map((row) => ({
      id: row.id ?? "",
      factionId: row.faction_id ?? "",
      name: row.name ?? "",
      type: row.type ?? "",
    })),
    stratagems: parsePipeCsv(files.Stratagems).map((row) => ({
      id: row.id ?? "",
      factionId: row.faction_id ?? "",
      name: row.name ?? "",
      type: row.type ?? "",
      cp: row.cp_cost ?? "",
      turn: row.turn ?? "",
      phase: row.phase ?? "",
      detachment: row.detachment ?? "",
      detachmentId: row.detachment_id ?? "",
      description: row.description ?? "",
    })),
    datasheets: parsePipeCsv(files.Datasheets).map((row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      factionId: row.faction_id ?? "",
      legend: row.legend ?? "",
    })),
    datasheetStratagems,
    unitStratagems,
    models,
    wargear,
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
