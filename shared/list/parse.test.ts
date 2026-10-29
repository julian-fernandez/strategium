import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArmyList } from "./parse";

const demo = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/demo-strike-force.txt"),
  "utf8",
);

describe("parseArmyList on the demo list", () => {
  const list = parseArmyList(demo);

  it("reads the header", () => {
    expect(list.note).toMatch(/^Triple paragons/);
    expect(list.faction).toBe("Adepta Sororitas");
    expect(list.detachmentText).toBe("Champions of Faith and Sanctified Orators");
    expect(list.detachmentPoints).toBe(3);
    expect(list.disposition).toBe("Disruption");
    expect(list.battleSize).toEqual({ name: "Strike Force", points: 2000 });
    expect(list.exporter).toMatch(/^Exported with New Recruit/);
    expect(list.warnings).toEqual([]);
  });

  it("reads every unit with its points", () => {
    expect(list.units).toHaveLength(17);
    expect(list.units.reduce((sum, unit) => sum + unit.points, 0)).toBe(2000);
  });

  it("reads four attached groups, with the Dialogus as Support", () => {
    const attached = list.units.filter((unit) => unit.attachment);
    expect(
      attached.map((unit) => [unit.name, unit.attachment?.role, unit.attachment?.group]),
    ).toEqual([
      ["Ministorum Priest", "leader", 1],
      ["Celestian Insidiants", "bodyguard", 1],
      ["Dialogus", "support", 2],
      ["Retributor Squad", "bodyguard", 2],
      ["Canoness with Jump Pack", "leader", 3],
      ["Zephyrim Squad", "bodyguard", 3],
      ["Morvenn Vahl", "leader", 4],
      ["Paragon Warsuits", "bodyguard", 4],
    ]);
  });

  it("splits model groups from single-model wargear", () => {
    const insidiants = list.units.find((unit) => unit.name === "Celestian Insidiants");
    expect(insidiants?.groups.map((group) => [group.count, group.name])).toEqual([
      [1, "Celestian Insidiant Superior"],
      [9, "Insidiant"],
    ]);
    expect(insidiants?.groups[1]?.items).toContainEqual({ count: 6, name: "Null mace" });
    expect(insidiants?.items).toEqual([]);

    const fraye = list.units.find((unit) => unit.name === "Intranzia Fraye");
    expect(fraye?.groups).toEqual([]);
    expect(fraye?.items.map((item) => [item.count, item.name])).toContainEqual([2, "Heavy bolter"]);
  });

  it("reads the warlord and enhancements", () => {
    const vahl = list.units.find((unit) => unit.name === "Morvenn Vahl");
    expect(vahl?.isWarlord).toBe(true);
    const dialogus = list.units.find((unit) => unit.name === "Dialogus");
    expect(dialogus?.enhancement).toBe("Triptych of Judgement");
  });
});

describe("parseArmyList on an Incursion list", () => {
  it("reads a 1,000-point battle size", () => {
    const list = parseArmyList(
      [
        "Adepta Sororitas",
        "Army of Faith (2 Detachment Points)",
        "Take and Hold",
        "Incursion (1,000 Points)",
        "",
        "CHARACTERS",
        "",
        "Canoness (50 Points)",
        "• Warlord",
        "• 1x Blessed blade",
        "• 1x Bolt pistol",
      ].join("\n"),
    );
    expect(list.battleSize).toEqual({ name: "Incursion", points: 1000 });
    expect(list.units[0]?.items).toHaveLength(2);
  });
});
