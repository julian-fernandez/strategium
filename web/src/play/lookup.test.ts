import { describe, expect, it } from "vitest";
import type { Army, Datasheet } from "../../../shared/types";
import { armyRuleIndex, normalize, search, searchable, searchableUnits } from "./lookup";
import { playEntries } from "./playOrder";

function unit(id: string, name: string, extra: Partial<Datasheet> = {}): Datasheet {
  return {
    id,
    name,
    models: [],
    coreAbilities: [],
    factionAbilities: [],
    abilities: [],
    wargearAbilities: [],
    ranged: [],
    melee: [],
    ...extra,
  } as unknown as Datasheet;
}

describe("normalize", () => {
  it("drops case, accents, curly quotes and punctuation", () => {
    expect(normalize("Bullgryn Bone ’ead — Re-roll #2")).toBe("bullgryn bone 'ead re roll 2");
    expect(normalize("Šalamander")).toBe("salamander");
  });
});

describe("search", () => {
  const list = [
    searchable("Command Re-roll", ["Command Re-roll"], "Re-roll one Hit roll."),
    searchable("Bullgryn Squad", ["Bullgryn Squad"]),
    searchable("Rapid Ingress", ["Rapid Ingress"], "Arrive from Reserves."),
    searchable("Grenade", ["Grenade"]),
  ];

  it("ranks a name's start, then word starts, then a name containing it, then the text", () => {
    expect(search(list, "gren")).toEqual(["Grenade"]);
    expect(search(list, "bul sq")).toEqual(["Bullgryn Squad"]);
    expect(search(list, "re")).toEqual(["Command Re-roll", "Rapid Ingress", "Grenade"]);
    expect(search(list, "reserves")).toEqual(["Rapid Ingress"]);
  });

  it("ignores spaces and hyphens", () => {
    expect(search(list, "reroll")).toEqual(["Command Re-roll"]);
  });

  it("returns everything, in order, for an empty query", () => {
    expect(search(list, "  ")).toHaveLength(4);
  });
});

describe("searchableUnits", () => {
  const army = {
    units: [
      unit("u1", "Bullgryn Squad", { models: [{ name: "Bullgryn Bone 'ead", count: 1 }] }),
      unit("u2", "Bullgryn Squad"),
      unit("u3", "Commissar"),
    ],
    groups: [{ id: 1, bodyguardId: "u2", characterIds: ["u3"], stratagemIds: [] }],
    stratagems: [],
  } as unknown as Army;
  const numbers = new Map([
    ["u1", 1],
    ["u2", 2],
  ]);
  const units = searchableUnits(playEntries(army), numbers);
  const found = (query: string) => search(units, query).map((entry) => entry.unit.id);

  it("finds a unit by its number, a model, or the character leading it", () => {
    expect(found("bullgryn 2")).toEqual(["u2"]);
    expect(found("bone")).toEqual(["u1"]);
    expect(found("commis")).toEqual(["u2"]);
  });
});

describe("armyRuleIndex", () => {
  const deepStrike = { name: "Deep Strike", html: "Set up in Reserves." };
  const wall = { name: "Wall of Muscle", html: "Subtract 1 from the Damage." };
  const army = {
    units: [
      unit("u1", "Bullgryn Squad", { abilities: [wall], coreAbilities: ["Deep Strike"] }),
      unit("u2", "Bullgryn Squad", { abilities: [wall] }),
      unit("u3", "Commissar", {
        enhancement: { name: "Exemplar of Duty", html: "Feel No Pain 4+." },
        abilities: [{ name: "Orders", html: "" }],
      }),
    ],
    armyRules: {
      rules: [{ name: "Voice of Command", html: "Orders." }],
      detachments: [{ name: "Steel Hammer", rules: [{ name: "Ceaseless Cannonade", html: "x" }] }],
      enhancements: [{ name: "Exemplar of Duty", cost: "10", bearer: "Commissar", html: "FNP" }],
    },
    glossary: [deepStrike, { name: "Voice of Command", html: "Orders." }],
  } as unknown as Army;
  const index = armyRuleIndex(army);
  const entry = (name: string) => index.find((rule) => rule.name === name);

  it("lists every rule once, alphabetically, with where it comes from", () => {
    expect(index.map((rule) => [rule.name, rule.source])).toEqual([
      ["Ceaseless Cannonade", "Steel Hammer"],
      ["Deep Strike", "Core ability"],
      ["Exemplar of Duty", "Enhancement"],
      ["Voice of Command", "Army rule"],
      ["Wall of Muscle", "Ability"],
    ]);
  });

  it("names the units that have each rule", () => {
    expect(entry("Wall of Muscle")?.unitIds).toEqual(["u1", "u2"]);
    expect(entry("Deep Strike")?.unitIds).toEqual(["u1"]);
    expect(entry("Exemplar of Duty")?.unitIds).toEqual(["u3"]);
  });
});
