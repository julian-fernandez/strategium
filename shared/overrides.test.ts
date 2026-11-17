import { describe, expect, it } from "vitest";
import { LISTS_DIR, readFixture, snapshotBundle } from "../fixtures";
import { parseGwText } from "./list/gw";
import { applyOverrides, overridesSchema, pointsBySize } from "./overrides";
import { buildArmy } from "./resolve/army";

/** The demo list on the committed Sororitas bundle, with these overrides laid over it. */
function demoWith(overrides: unknown) {
  const list = parseGwText(readFixture(LISTS_DIR, "adepta-sororitas.txt"));
  const { bundle } = applyOverrides(snapshotBundle(list.faction), overridesSchema.parse(overrides));
  return buildArmy(list, bundle, {});
}

const unit = (army: ReturnType<typeof demoWith>, name: string) => {
  const found = army.units.find((u) => u.name === name);
  if (!found) throw new Error(`no ${name}`);
  return found;
};

describe("applyOverrides", () => {
  it("reprices a unit by squad size", () => {
    const before = unit(demoWith({}), "Celestian Insidiants").points;
    const after = unit(
      demoWith({ units: { "Celestian Insidiants": { points: { "10": 120 } } } }),
      "Celestian Insidiants",
    );
    expect(before).toBe(115);
    expect(after.points).toBe(120);
  });

  it("changes a weapon wherever the unit has it, and a stat line by name", () => {
    const army = demoWith({
      units: {
        "Retributor Squad": {
          weapons: { "Multi-melta": { attacks: "3" } },
          stats: { "Retributor Superior": { oc: "2" } },
        },
      },
    });
    const retributors = unit(army, "Retributor Squad");
    expect(retributors.ranged.find((row) => row.name === "Multi-melta")?.profiles[0]?.attacks).toBe(
      "3",
    );
    expect(retributors.stats.find((line) => line.name === "Retributor Superior")?.oc).toBe("2");
  });

  it("prices enhancements, where BSData's own price would otherwise win", () => {
    const list = parseGwText(readFixture(LISTS_DIR, "adepta-sororitas.txt"));
    const bundle = snapshotBundle(list.faction);
    const enhancement = bundle.detachments.flatMap((d) => d.enhancements)[0];
    if (!enhancement) throw new Error("no enhancement");
    const { bundle: changed } = applyOverrides(
      bundle,
      overridesSchema.parse({ enhancements: { [enhancement.name]: 99 } }),
    );
    const costs = changed.detachments
      .flatMap((d) => d.enhancements)
      .filter((e) => e.name === enhancement.name);
    expect(costs.every((e) => e.cost === "99")).toBe(true);
  });

  it("adds and drops keywords and abilities", () => {
    const army = demoWith({
      units: {
        "Celestian Insidiants": {
          keywords: { add: ["Smoke"] },
          abilities: { "Rituale Nullificatus": null, "New Rule": "Does a thing." },
        },
      },
    });
    const insidiants = unit(army, "Celestian Insidiants");
    expect(insidiants.keywords).toContain("Smoke");
    expect(insidiants.abilities.map((a) => a.name)).toContain("New Rule");
    expect(insidiants.abilities.map((a) => a.name)).not.toContain("Rituale Nullificatus");
  });

  it("refuses a change it can't place, so a typo never passes silently", () => {
    expect(() => demoWith({ units: { "Celestian Insidient": { points: { "10": 120 } } } })).toThrow(
      /no unit named "Celestian Insidient"/,
    );
    expect(() =>
      demoWith({
        units: { "Retributor Squad": { weapons: { "Multi melta gun": { attacks: "3" } } } },
      }),
    ).toThrow(/no weapon named "Multi melta gun"/);
  });

  it("leaves the bundle it was given alone", () => {
    const list = parseGwText(readFixture(LISTS_DIR, "adepta-sororitas.txt"));
    const bundle = snapshotBundle(list.faction);
    const before = JSON.stringify(bundle);
    applyOverrides(
      bundle,
      overridesSchema.parse({ units: { "Retributor Squad": { points: { "5": 1 } } } }),
    );
    expect(JSON.stringify(bundle)).toBe(before);
  });
});

describe("pointsBySize", () => {
  it("prices the smallest size, then each larger one from its size up, keeping the repeat surcharge", () => {
    const points = pointsBySize(
      { base: 50, rules: [], repeat: { after: 2, value: 10 }, exact: false },
      { "10": 120, "5": 60 },
    );
    expect(points).toEqual({
      base: 60,
      rules: [{ op: "set", value: 120, when: [{ compare: "atLeast", value: 10 }] }],
      repeat: { after: 2, value: 10 },
      exact: true,
    });
  });
});
