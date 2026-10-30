import { describe, expect, it } from "vitest";
import { snapshotBundle } from "../../fixtures";
import { parseGuided } from "../list/guided";
import type { Datasheet, Edit, LoadoutPick, LoadoutRow, Swap } from "../types";
import { buildArmy } from "./army";
import { applyEdits } from "./edits";
import { apartFrom } from "./swaps";

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

function row(sheet: Datasheet, label: string): LoadoutRow {
  const found = sheet.loadout.find((r) => r.label === label);
  if (!found) throw new Error(`no ${label} in ${sheet.loadout.map((r) => r.label)}`);
  return found;
}

function pick(found: LoadoutRow, name: string): LoadoutPick {
  const picked = found.picks.find((p) => p.name === name);
  if (!picked) throw new Error(`no ${name} in ${found.picks.map((p) => p.name)}`);
  return picked;
}

function option(swaps: Swap[], label: string): Swap {
  const found = swaps.find((s) => s.label === label);
  if (!found) throw new Error(`no ${label} in ${swaps.map((s) => s.label)}`);
  return found;
}

function asEdit(army: ReturnType<typeof build>, sheet: Datasheet, swap: Swap, times = 1): Edit {
  return {
    unit: army.units.indexOf(sheet),
    model: swap.model,
    toModel: swap.toModel,
    remove: swap.remove,
    add: swap.add,
    times,
  };
}

const counts = (sheet: Datasheet) =>
  Object.fromEntries([...sheet.ranged, ...sheet.melee].map((r) => [r.name, r.count]));

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

describe("the loadout", () => {
  const army = build();

  it("reads a squad by its models: the leader, the troopers, then each specialist and its limit", () => {
    const dominions = unit(army.units, "Dominion Squad");
    expect(
      dominions.loadout.map((r) => `${r.label} ${r.max ? `${r.count}/${r.max}` : r.count}`),
    ).toEqual(["Superior 1", "Dominion 5", "Simulacrum Imperialis 0/1", "Special Weapon 4/4"]);
    expect(row(dominions, "Dominion").fixed.map((i) => i.name)).toEqual([
      "Bolt pistol",
      "Boltgun",
      "Close combat weapon",
    ]);
  });

  it("offers a character the other choices in each of her slots", () => {
    const canoness = unit(army.units, "Canoness").loadout[0];
    if (!canoness) throw new Error("no loadout");
    expect(pick(canoness, "Blessed blade").swaps.map((s) => s.label)).toEqual([
      "Power weapon",
      "Hallowed Chainsword",
    ]);
    // Her optional slot is empty: each choice is an addition.
    expect(pick(canoness, "").swaps.map((s) => s.label)).toEqual([
      "Null Rod",
      "Brazier of Holy Fire",
      "Rod of Office",
    ]);
  });

  it("swaps a specialist's weapon, or sends it back to being a trooper", () => {
    const special = row(unit(army.units, "Dominion Squad"), "Special Weapon");
    const melta = pick(special, "Meltagun");
    expect(melta.count).toBe(4);
    expect(option(melta.swaps, "Ministorum Flamer")).toMatchObject({ cost: -5 });
    expect(option(melta.swaps, "Boltgun")).toMatchObject({ toLabel: "Dominion", cost: -5 });
  });

  it("lets a trooper become a specialist only while there's room", () => {
    const dominions = unit(army.units, "Dominion Squad");
    expect(row(dominions, "Special Weapon").full).toBe("All 4 places taken.");
    expect(row(dominions, "Simulacrum Imperialis").full).toBeUndefined();
    const seraphim = unit(army.units, "Seraphim Squad");
    expect(row(seraphim, "Special Weapons")).toMatchObject({
      count: 2,
      max: 2,
      full: "All 2 places taken.",
    });
  });

  it("labels a model type by what sets it apart", () => {
    expect(apartFrom("Dominion w/ Special Weapon", "Dominion")).toBe("Special Weapon");
    expect(apartFrom("Celestian Insidiant w/ hand flamer", "Celestian Insidiant")).toBe(
      "Hand flamer",
    );
    expect(
      apartFrom("Celestian Sacresant (Hallowed Mace)", "Celestian Sacresant (Anointed Halberd)"),
    ).toBe("Hallowed Mace");
  });
});

describe("edits", () => {
  it("swaps all four meltaguns for flamers at once, and reprices the squad", () => {
    const before = build();
    const dominions = unit(before.units, "Dominion Squad");
    const flamer = option(
      pick(row(dominions, "Special Weapon"), "Meltagun").swaps,
      "Ministorum Flamer",
    );

    const after = build([asEdit(before, dominions, flamer, 4)]);
    const edited = unit(after.units, "Dominion Squad");
    expect(counts(edited)).toMatchObject({ "Ministorum flamer": 4, Boltgun: 6 });
    expect(counts(edited).Meltagun).toBeUndefined();
    expect(edited.points).toBe(90);
    expect(row(edited, "Special Weapon").full).toBe("All 4 places taken.");
    // An edited list's points aren't compared with what it said.
    expect(after.warnings.some((w) => w.includes("adds up to"))).toBe(false);
  });

  it("gives a Dominion the Simulacrum without adding a model, then allows no second", () => {
    const before = build();
    const dominions = unit(before.units, "Dominion Squad");
    const join = option(row(dominions, "Simulacrum Imperialis").joins, "Simulacrum Imperialis");

    const after = unit(build([asEdit(before, dominions, join)]).units, "Dominion Squad");
    expect(after.modelCount).toBe(10);
    expect(after.wargearAbilities.map((a) => a.name)).toContain("Simulacrum Imperialis");
    const simulacrum = row(after, "Simulacrum Imperialis");
    expect(simulacrum).toMatchObject({ count: 1, full: "Only one per squad." });
    // The one it has can be given up again.
    expect(
      option(pick(simulacrum, "Simulacrum Imperialis").swaps, "No Simulacrum Imperialis"),
    ).toMatchObject({
      toLabel: "Dominion",
      blocked: undefined,
    });
  });

  it("adds an option to the Superior, carried by her alone", () => {
    const before = build();
    const dominions = unit(before.units, "Dominion Squad");
    const power = option(pick(row(dominions, "Superior"), "").swaps, "Power weapon");

    const after = unit(build([asEdit(before, dominions, power)]).units, "Dominion Squad");
    expect(after.melee.find((r) => r.name === "Power weapon")).toMatchObject({
      count: 1,
      carrier: "Superior",
    });
  });

  it("skips an edit that no longer fits the list", () => {
    const { skipped } = applyEdits(parseGuided(LIST, bundle), bundle, [
      { unit: 1, model: "Canoness", remove: [{ name: "Plasma pistol", count: 1 }], add: [] },
    ]);
    expect(skipped).toBe(1);
  });
});
