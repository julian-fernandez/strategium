import { describe, expect, it } from "vitest";
import { snapshotBundle } from "../../fixtures";
import { parseGuided } from "../list/guided";
import type { Datasheet, Edit, Swap } from "../types";
import { buildArmy } from "./army";
import { applyEdits } from "./edits";

/** Runs on the committed, trimmed bundle in fixtures/bundles: no synced data needed. */
const bundle = snapshotBundle("Adepta Sororitas");

const LIST = `Adepta Sororitas

Morvenn Vahl + 3 Paragon Warsuits (380 pts)
Canoness (60 pts): Bolt pistol, Blessed blade
10 Dominion Squad (110 pts): 10 Bolt pistol, 6 Boltgun, 4 Meltagun, 10 Close combat weapon
5 Seraphim Squad (75 pts): 6 Bolt pistol, 4 Ministorum hand flamer, 5 Close combat weapon
10 Seraphim Squad (150 pts)
5 Seraphim Squad (75 pts)
5 Seraphim Squad (75 pts)`;

function build(edits: Edit[] = []) {
  const { list } = applyEdits(parseGuided(LIST, bundle), bundle, edits);
  return buildArmy(list, bundle, {}, undefined, { checkPoints: !edits.length });
}

function unit(units: Datasheet[], name: string, nth = 0): Datasheet {
  const found = units.filter((u) => u.name === name)[nth];
  if (!found) throw new Error(`no ${name}`);
  return found;
}

function swapsFor(sheet: Datasheet, weapon: string): Swap[] {
  return [...sheet.ranged, ...sheet.melee].find((row) => row.name === weapon)?.swaps ?? [];
}

function asEdit(army: ReturnType<typeof build>, sheet: Datasheet, swap: Swap): Edit {
  return {
    unit: army.units.indexOf(sheet),
    model: swap.model,
    toModel: swap.toModel,
    remove: swap.remove,
    add: swap.add,
  };
}

describe("points", () => {
  const army = build();

  it("prices units by size, wargear and repeats", () => {
    expect(unit(army.units, "Morvenn Vahl").points).toBe(215);
    expect(unit(army.units, "Paragon Warsuits").points).toBe(165);
    // 90, and 5 for each of its four meltaguns.
    expect(unit(army.units, "Dominion Squad").points).toBe(110);
    // Five Seraphim are 75; ten are 150.
    expect(unit(army.units, "Seraphim Squad", 0).points).toBe(75);
    expect(unit(army.units, "Seraphim Squad", 1).points).toBe(150);
    // A copy with two of the same datasheet before it costs 10 more: the third and fourth.
    expect(unit(army.units, "Seraphim Squad", 2).points).toBe(85);
    expect(unit(army.units, "Seraphim Squad", 3).points).toBe(85);
  });

  it("says when the list's own total differs from the current points", () => {
    expect(army.warnings).toContain("The list adds up to 925 pts; at the current points it's 945.");
  });
});

describe("swaps", () => {
  const army = build();

  it("offers a character the other choices in each of her slots", () => {
    const canoness = unit(army.units, "Canoness");
    expect(swapsFor(canoness, "Blessed blade").map((s) => s.label)).toEqual([
      "Power weapon",
      "Hallowed Chainsword",
    ]);
    expect(canoness.extras.map((s) => s.label)).toEqual([
      "Null Rod",
      "Brazier of Holy Fire",
      "Rod of Office",
    ]);
  });

  it("gives a trooper a special weapon by changing its type, within the squad's limit", () => {
    const dominions = unit(army.units, "Dominion Squad");
    const meltagun = swapsFor(dominions, "Boltgun").find(
      (s) => s.label === "Meltagun" && s.toModel === "Dominion w/ Special Weapon",
    );
    expect(meltagun).toMatchObject({ cost: 5, blocked: "4 of 4 Dominion w/ Special Weapon" });
    // The superior's own boltgun swaps within her slot, priced and unlimited.
    expect(
      swapsFor(dominions, "Boltgun")
        .filter((s) => s.modelLabel === "Superior")
        .map((s) => s.label),
    ).toContain("Combi-weapon");
    // A meltagun back to a boltgun frees a place and saves its points.
    expect(swapsFor(dominions, "Meltagun").find((s) => s.toModel === "Dominion")).toMatchObject({
      cost: -5,
      blocked: undefined,
    });
  });

  it("counts squads by what only one model type can carry", () => {
    const seraphim = unit(army.units, "Seraphim Squad");
    const flamers = swapsFor(seraphim, "Bolt pistol").filter(
      (s) => s.toModel === "Seraphim with Special Weapons",
    );
    expect(flamers.map((s) => s.blocked)).toEqual([
      "2 of 2 Seraphim with Special Weapons",
      "2 of 2 Seraphim with Special Weapons",
    ]);
  });
});

describe("edits", () => {
  it("swaps a meltagun for a flamer, reprices the squad, and frees nothing", () => {
    const before = build();
    const dominions = unit(before.units, "Dominion Squad");
    const flamer = swapsFor(dominions, "Meltagun").find((s) => s.label === "Ministorum Flamer");
    if (!flamer) throw new Error("no flamer swap");

    const after = build([asEdit(before, dominions, flamer)]);
    const edited = unit(after.units, "Dominion Squad");
    expect(Object.fromEntries(edited.ranged.map((row) => [row.name, row.count]))).toMatchObject({
      Meltagun: 3,
      "Ministorum flamer": 1,
      Boltgun: 6,
    });
    expect(edited.points).toBe(105);
    // Still four special weapons: no fifth.
    expect(swapsFor(edited, "Boltgun").find((s) => s.label === "Meltagun")?.blocked).toBe(
      "4 of 4 Dominion w/ Special Weapon",
    );
    // An edited list's points aren't compared with what it said.
    expect(after.warnings.some((w) => w.includes("adds up to"))).toBe(false);
  });

  it("adds an option to a model, carried by it alone", () => {
    const before = build();
    const dominions = unit(before.units, "Dominion Squad");
    const power = dominions.extras.find((s) => s.label === "Power weapon");
    if (!power) throw new Error("no power weapon option");

    const after = unit(build([asEdit(before, dominions, power)]).units, "Dominion Squad");
    expect(after.melee.find((row) => row.name === "Power weapon")).toMatchObject({ count: 1 });
  });

  it("skips an edit that no longer fits the list", () => {
    const { skipped } = applyEdits(parseGuided(LIST, bundle), bundle, [
      { unit: 1, model: "Canoness", remove: [{ name: "Plasma pistol", count: 1 }], add: [] },
    ]);
    expect(skipped).toBe(1);
  });
});
