import { describe, expect, it } from "vitest";
import { snapshotBundle } from "../fixtures";
import { factionDrift, ourPrice, parseCosts } from "./drift";
import type { Wahapedia } from "./wahapedia";

describe("parseCosts", () => {
  it("reads squad sizes, later copies and option costs, and skips other armies' sections", () => {
    const line = (description: string, cost = "") => ({ description, cost });
    expect(
      parseCosts([
        line("YOUR UNIT COSTS"),
        line("5 models", "60"),
        line("10 models", "120"),
        line("YOUR 3RD+ UNIT COSTS"),
        line("5 models", "70"),
        line("10 models", "140"),
        line("WARGEAR OPTIONS"),
        line("per Multi-melta", "10"),
        line('<div class="dsHeaderAoI">Assigned Agent</div>'),
        line("1 model", "999"),
      ]),
    ).toEqual({
      sizes: { 5: 60, 10: 120 },
      repeat: { after: 2, sizes: { 5: 70, 10: 140 } },
      options: { "Multi-melta": 10 },
    });
  });
});

describe("factionDrift", () => {
  const bundle = snapshotBundle("Adepta Sororitas");
  const insidiants = Object.values(bundle.units).find((u) => u.name === "Celestian Insidiants");
  const id = insidiants?.wahapedia?.id ?? "";
  const wahapedia = (costs: { description: string; cost: string }[]) =>
    ({
      costs: new Map([[id, costs]]),
      wargear: new Map(),
      keywords: new Map(),
      datasheets: [],
    }) as unknown as Wahapedia;

  it("prices a unit the way the list does", () => {
    if (!insidiants) throw new Error("no Insidiants in the fixture");
    expect(ourPrice(insidiants, 10)).toBe(115);
  });

  it("proposes the points Wahapedia gives when they differ", () => {
    const drift = factionDrift(
      bundle,
      wahapedia([
        { description: "YOUR UNIT COSTS", cost: "" },
        { description: "10 models", cost: "120" },
      ]),
    );
    const found = drift.units.find((u) => u.unit === "Celestian Insidiants");
    expect(found?.findings).toContainEqual({
      what: "points for 10 models",
      ours: "115",
      theirs: "120",
    });
    expect(found?.proposal.points).toEqual({ "10": 120 });
  });

  it("finds nothing when the two agree", () => {
    const drift = factionDrift(
      bundle,
      wahapedia([
        { description: "YOUR UNIT COSTS", cost: "" },
        { description: "10 models", cost: "115" },
      ]),
    );
    expect(drift.units.find((u) => u.unit === "Celestian Insidiants")).toBeUndefined();
  });
});
