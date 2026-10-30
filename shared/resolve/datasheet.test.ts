import { describe, expect, it } from "vitest";
import { COMPILER_VERSION, type FactionBundle, type ItemData, type UnitData } from "../bundle";
import type { ListUnit } from "../list/types";
import { modelLabel, resolveDatasheet } from "./datasheet";

const rapier: ItemData = {
  name: "Monomolecular cane-rapier",
  ranged: [],
  melee: [
    {
      name: "Monomolecular cane-rapier",
      range: "Melee",
      attacks: "4",
      skill: "2+",
      strength: "4",
      ap: "-2",
      damage: "1",
      keywords: ["Precision"],
    },
  ],
  abilities: [],
};

const entourage: UnitData = {
  name: "Rogue Trader Entourage",
  stats: [{ name: "Rogue Trader", m: '6"', t: "3", sv: "4+", w: "4", ld: "6+", oc: "1" }],
  abilities: [],
  coreRules: [],
  factionRules: [],
  keywords: ["Infantry"],
  factionKeywords: ["Imperium"],
  models: {},
  points: { base: 0, rules: [], exact: true },
  costs: {},
  aliases: {},
  items: {
    "monomolecular cane-rapier": rapier,
    "deadly combatant": { name: "Deadly combatant", ranged: [], melee: [], abilities: [] },
  },
  modifiers: [
    {
      when: "deadly combatant",
      profile: "Monomolecular cane-rapier",
      field: "keywords",
      op: "append",
      value: "Sustained Hits 1",
    },
  ],
  crossCheck: [],
};

const bundle: FactionBundle = {
  compilerVersion: COMPILER_VERSION,
  faction: "Imperial Agents",
  catalogue: "Imperium - Agents of the Imperium",
  sources: { bsdataSha: "", wahapediaUpdate: "" },
  units: { "rogue trader entourage": entourage },
  detachments: [],
  stratagems: [],
  rules: {},
};

function listUnit(items: string[]): ListUnit {
  return {
    name: "Rogue Trader Entourage",
    points: 85,
    section: "CHARACTERS",
    isWarlord: false,
    groups: [],
    items: items.map((name) => ({ count: 1, name })),
  };
}

const keywords = (items: string[]) =>
  resolveDatasheet(bundle, listUnit(items), "u1").melee[0]?.profiles[0]?.keywords;

describe("resolveDatasheet modifiers", () => {
  it("applies a selection's modifier only when the list takes that selection", () => {
    expect(keywords(["Monomolecular cane-rapier", "Deadly combatant"])).toEqual([
      "Precision",
      "Sustained Hits 1",
    ]);
    expect(keywords(["Monomolecular cane-rapier"])).toEqual(["Precision"]);
  });

  it("never changes the bundle it reads from", () => {
    keywords(["Monomolecular cane-rapier", "Deadly combatant"]);
    expect(rapier.melee[0]?.keywords).toEqual(["Precision"]);
  });
});

describe("modelLabel", () => {
  it("drops the words a model shares with its unit", () => {
    expect(modelLabel("Celestian Insidiant Superior", "Celestian Insidiants")).toBe("Superior");
    expect(modelLabel("Sister Superior", "Battle Sisters Squad")).toBe("Superior");
    expect(modelLabel("Assault Intercessor Sergeant", "Assault Intercessor Squad")).toBe(
      "Sergeant",
    );
    expect(modelLabel("Nob", "Tankbustas")).toBe("Nob");
    expect(modelLabel("Zephyrim", "Zephyrim Squad")).toBe("Zephyrim");
  });
});
