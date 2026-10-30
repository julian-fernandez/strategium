import { describe, expect, it } from "vitest";
import { snapshotBundle } from "../../fixtures";
import { parseGuided } from "../list/guided";
import type { Datasheet } from "../types";
import { buildArmy } from "./army";

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

const army = buildArmy(parseGuided(LIST, bundle), bundle, {});

function unit(name: string, nth = 0): Datasheet {
  const found = army.units.filter((u) => u.name === name)[nth];
  if (!found) throw new Error(`no ${name}`);
  return found;
}

describe("points", () => {
  it("prices a unit at its base cost, and a character on its own", () => {
    expect(unit("Morvenn Vahl").points).toBe(215);
    expect(unit("Paragon Warsuits").points).toBe(165);
    expect(unit("Canoness").points).toBe(60);
  });

  it("adds what wargear costs on top", () => {
    // 90, and 5 for each of its four meltaguns.
    expect(unit("Dominion Squad").points).toBe(110);
  });

  it("prices a squad by its size", () => {
    // Five Seraphim are 75; ten are 150.
    expect(unit("Seraphim Squad", 0).points).toBe(75);
    expect(unit("Seraphim Squad", 1).points).toBe(150);
  });

  it("charges extra for a datasheet once two copies come before it", () => {
    expect(unit("Seraphim Squad", 2).points).toBe(85);
    expect(unit("Seraphim Squad", 3).points).toBe(85);
  });

  it("says when the list's own total differs from the current points", () => {
    expect(army.warnings).toContain("The list adds up to 925 pts; at the current points it's 945.");
  });
});
