import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalogues, loadWahapedia } from "../server/data";
import { buildArmy } from "./army";
import { parseArmyList } from "./list/parse";
import type { Army, Datasheet, WeaponRow } from "./types";

/** These tests read the synced data in data/cache. Run `pnpm sync-data` first. */
const hasData = existsSync(path.resolve(import.meta.dirname, "../data/cache/meta.json"));

const demo = readFileSync(
  path.resolve(import.meta.dirname, "../fixtures/demo-strike-force.txt"),
  "utf8",
);

function counts(rows: WeaponRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.name, row.count]));
}

describe.skipIf(!hasData)("buildArmy on the demo list", () => {
  let army: Army;
  const unit = (name: string): Datasheet => {
    const found = army.units.find((u) => u.name === name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };

  beforeAll(async () => {
    const list = parseArmyList(demo);
    army = buildArmy(list, await loadCatalogues(list.faction), await loadWahapedia(), {});
  });

  it("loads without warnings", () => {
    expect(army.warnings).toEqual([]);
    expect(army.battleSize).toEqual({ name: "Strike Force", points: 2000, supported: true });
    expect(army.detachments).toEqual(["Champions of Faith", "Sanctified Orators"]);
  });

  it("counts the Insidiants' weapons and keeps only their wargear abilities", () => {
    const insidiants = unit("Celestian Insidiants");
    expect(counts(insidiants.ranged)).toEqual({
      "Inferno pistol": 1,
      "Condemnor bolt pistol": 3,
      "Ministorum hand flamer": 2,
    });
    expect(counts(insidiants.melee)).toEqual({
      "Null mace": 7,
      "Blessed sword": 2,
      "Virge of Admonition": 1,
    });
    expect(insidiants.wargearAbilities.map((a) => a.name).sort()).toEqual([
      "Denuncia Oratory",
      "Simulacrum Imperialis",
    ]);
    expect(insidiants.modelCount).toBe(10);
  });

  it("counts the Dominion Squad's weapons and nothing it didn't take", () => {
    const dominion = unit("Dominion Squad");
    expect(counts(dominion.ranged)).toEqual({
      "Bolt pistol": 10,
      Boltgun: 5,
      "Ministorum flamer": 4,
      "Ministorum hand flamer": 1,
    });
    expect(counts(dominion.melee)).toEqual({ "Close combat weapon": 10, "Power weapon": 1 });
  });

  it("splits a weapon with ranged and melee profiles into both tables", () => {
    const priest = unit("Ministorum Priest");
    expect(counts(priest.ranged)).toEqual({ "Zealot's vindictor": 1 });
    expect(counts(priest.melee)).toEqual({ "Zealot's vindictor": 1 });
  });

  it("keeps several profiles of one weapon on one counted row", () => {
    const zephyrim = unit("Zephyrim Squad");
    const plasma = zephyrim.ranged.find((row) => row.name === "Plasma pistol");
    expect(plasma?.count).toBe(1);
    expect(plasma?.profiles).toHaveLength(2);
  });

  it("splits core and faction abilities and keywords", () => {
    const canoness = unit("Canoness with Jump Pack");
    expect(canoness.coreAbilities).toEqual(["Deep Strike", "Leader"]);
    expect(canoness.factionAbilities).toEqual(["Acts of Faith"]);
    expect(canoness.attachTo?.title).toBe("Leader");
    expect(canoness.keywords).toContain("Jump Pack");
    expect(canoness.keywords).not.toContain("Leader");
    expect(canoness.factionKeywords).toEqual(["Adepta Sororitas"]);
    expect(canoness.enhancement?.name).toBe("Mark of Devotion");
    expect(unit("Dialogus").attachTo?.title).toBe("Support");
    expect(unit("Morvenn Vahl").isWarlord).toBe(true);
  });

  it("forms four attached groups, with the Dialogus as Support", () => {
    expect(army.groups).toHaveLength(4);
    const second = army.groups.find((g) => g.id === 2);
    expect(second && unit("Retributor Squad").id).toBe(second?.bodyguardId);
    expect(second?.characterIds).toEqual([unit("Dialogus").id]);
    expect(unit("Dialogus").attachment?.role).toBe("support");
  });

  it("keeps only core and chosen-detachment stratagems a unit can use", () => {
    const detachments = new Set(army.stratagems.map((s) => s.detachment));
    expect([...detachments].sort()).toEqual(["", "Champions of Faith"]);
    expect(army.stratagems.some((s) => s.detachment === "Bringers of Flame")).toBe(false);
    // 11th-edition core only: no 10th-edition Grenade or Tank Shock.
    const names = army.stratagems.map((s) => s.name);
    expect(names).not.toContain("GRENADE");
    expect(names).not.toContain("TANK SHOCK");
    expect(army.stratagems.find((s) => s.name === "SMOKESCREEN")?.usableBy).toEqual(["Immolator"]);
    expect(army.stratagems.find((s) => s.name === "NEW ORDERS")?.usableBy).toEqual([]);
    expect(army.stratagems.find((s) => s.name === "INSANE BRAVERY")?.everyUnit).toBe(true);
    expect(army.stratagems.find((s) => s.name === "INSANE BRAVERY")?.when).toBe(
      "Battle-shock step of your Command phase, just before you make a battle-shock roll for a friendly unit.",
    );
    for (const stratagem of army.stratagems) expect(stratagem.when).not.toBe("");
    expect(army.stratagems.find((s) => s.name === "SMOKESCREEN")?.everyUnit).toBe(false);
    for (const stratagem of army.stratagems) {
      if (stratagem.name !== "NEW ORDERS") expect(stratagem.usableBy.length).toBeGreaterThan(0);
    }
  });

  it("agrees with Wahapedia on every stat and weapon", () => {
    expect(army.crossCheck).toEqual([]);
  });
});
