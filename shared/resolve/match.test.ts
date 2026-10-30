import { describe, expect, it } from "vitest";
import { FORMATS_DIR, LISTS_DIR, readFixture, snapshotBundle } from "../../fixtures";
import { readList } from "../list/formats";
import type { Army } from "../types";
import { buildArmy } from "./army";
import { nearest } from "./match";

async function army(dir: string, file: string): Promise<Army> {
  const { list, format, bundle } = await readList(readFixture(dir, file), async (faction) =>
    snapshotBundle(faction),
  );
  return buildArmy(list, bundle, {}, format);
}

const unmatched = (built: Army) =>
  built.warnings.filter((w) => /has no (wargear|unit|model)/.test(w));

describe("nearest", () => {
  const names: [string, string][] = [
    ["a", "chirugeon's tool"],
    ["b", "attendant's hellblade"],
    ["c", "bolt pistol"],
  ];

  it("takes a slip of a letter or two in a longer name", () => {
    expect(nearest(names, "chirurgeon's tool")).toBe("a");
    expect(nearest(names, "attendants' hellblade")).toBe("b");
  });

  it("leaves short names alone, and refuses a tie", () => {
    // Under seven letters, no slip at all: "claws" isn't taken for "claw".
    expect(nearest([["x", "claw"]], "claws")).toBeUndefined();
    expect(nearest([...names, ["d", "chirurgeon's tooL"]], "chirurgeon's toolx")).toBeUndefined();
  });
});

describe("names the data spells differently", () => {
  it("reads the official name of a weapon BSData calls something else", async () => {
    const ultramarines = await army(LISTS_DIR, "ultramarines.txt");
    // Wahapedia's "Master-crafted Power Sword" is BSData's "Master-crafted power weapon".
    expect(ultramarines.warnings.join("\n")).not.toContain("Master-crafted Power Sword");
    const bladeguard = ultramarines.units.find((u) => u.name === "Bladeguard Veteran Squad");
    expect(bladeguard?.melee.map((r) => r.name)).toContain("Master-crafted power weapon");
  });

  it("reads a model named with a word left out or a letter wrong", async () => {
    const deathGuard = await army(LISTS_DIR, "death-guard.txt");
    const deathshroud = deathGuard.units.find((u) => u.name === "Deathshroud Terminators");
    expect(deathshroud?.models.map((m) => m.name)).toContain("Deathshroud Champion");
    expect(unmatched(deathGuard)).toEqual([]);
    expect(unmatched(await army(LISTS_DIR, "ultramarines.txt"))).toEqual([]);
  });

  it("reads wargear BSData draws on a model type, such as a Simulacrum", async () => {
    const agents = await army(LISTS_DIR, "imperial-agents.txt");
    const sisters = agents.units.find((u) => u.name === "Sisters of Battle Squad");
    expect(sisters?.wargearAbilities.map((a) => a.name)).toContain("Simulacrum Imperialis");
  });
});

describe("a unit whose name line the export lost", () => {
  it("is read as its own unit, with a warning", async () => {
    const custodes = await army(LISTS_DIR, "adeptus-custodes.txt");
    const wardens = custodes.units.filter((u) => u.name === "Custodian Wardens");
    expect(wardens.some((u) => u.modelCount === 4)).toBe(true);
    expect(custodes.warnings).toContain(
      "The list has Custodian Wardens models after Vigilators with no unit line of their own; they're read as a unit of Custodian Wardens.",
    );
    // The Vigilators keep only their own.
    const vigilators = custodes.units.find((u) => u.name === "Vigilators");
    expect(vigilators?.modelCount).toBe(9);
  });

  it("isn't invented from an older list's model names", async () => {
    const deathwatch = await army(LISTS_DIR, "deathwatch.txt");
    expect(deathwatch.warnings.join("\n")).not.toContain("no unit line of their own");
    expect(deathwatch.units.some((u) => u.name === "Deathwatch Kill Team")).toBe(false);
  });

  it("leaves well-formed lists alone", async () => {
    const formats = await army(FORMATS_DIR, "gwapp-flat.adepta-sororitas.txt");
    expect(formats.warnings.join("\n")).not.toContain("no unit line of their own");
  });
});
