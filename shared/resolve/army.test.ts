import { beforeAll, describe, expect, it } from "vitest";
import { LISTS_DIR, readFixture, snapshotBundle } from "../../fixtures";
import { parseGwText as parseArmyList } from "../list/gw";
import type { Army, Datasheet, WeaponRow } from "../types";
import { buildArmy } from "./army";

/** Runs on the committed, trimmed bundle in fixtures/bundles: no synced data needed. */
const demo = readFixture(LISTS_DIR, "adepta-sororitas.txt");

function counts(rows: WeaponRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.name, row.count]));
}

describe("buildArmy on the demo list", () => {
  let army: Army;
  const unit = (name: string): Datasheet => {
    const found = army.units.find((u) => u.name === name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };

  beforeAll(() => {
    const list = parseArmyList(demo);
    army = buildArmy(list, snapshotBundle(list.faction), {});
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
    expect(army.stratagems.find((s) => s.name === "SMOKESCREEN")?.everyUnit).toBe(false);
    for (const stratagem of army.stratagems) {
      if (stratagem.name !== "NEW ORDERS") expect(stratagem.usableBy.length).toBeGreaterThan(0);
    }
  });

  it("agrees with Wahapedia on every stat and weapon", () => {
    expect(army.crossCheck).toEqual([]);
  });

  it("marks weapons only the squad's leader carries, and nothing shared", () => {
    const carriers = (name: string) =>
      Object.fromEntries(
        [...unit(name).ranged, ...unit(name).melee]
          .filter((row) => row.carrier)
          .map((row) => [row.name, row.carrier]),
      );
    expect(carriers("Celestian Insidiants")).toEqual({ "Inferno pistol": "Superior" });
    expect(carriers("Zephyrim Squad")).toEqual({ "Plasma pistol": "Superior" });
    // Single models and characters get no tag.
    expect(carriers("Morvenn Vahl")).toEqual({});
  });

  it("applies a selection-free BSData modifier at compile time", () => {
    const boltgun = unit("Dominion Squad").ranged.find((row) => row.name === "Boltgun");
    expect(boltgun?.profiles[0]?.keywords).toEqual(["Rapid Fire 1", "Assault"]);
  });

  it("collects the army rules: faction rule, detachment rules, enhancements taken", () => {
    expect(army.armyRules.rules.map((r) => r.name)).toEqual(["Acts of Faith"]);
    expect(army.armyRules.detachments.map((d) => d.name)).toEqual([
      "Champions of Faith",
      "Sanctified Orators",
    ]);
    expect(army.armyRules.enhancements.map(({ html, ...rest }) => rest)).toEqual([
      { name: "Triptych of Judgement", cost: "15", bearer: "Dialogus" },
      { name: "Mark of Devotion", cost: "30", bearer: "Canoness with Jump Pack" },
    ]);
  });

  it("builds a glossary of the core abilities and weapon keywords the army uses", () => {
    const names = army.glossary.map((g) => g.name);
    expect(names).toContain("Deep Strike");
    expect(names).toContain("Rapid Fire");
    expect(names).toContain("Anti");
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });
});
