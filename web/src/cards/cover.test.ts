import { describe, expect, it } from "vitest";
import type { Army } from "../../../shared/types";
import { coverKey, coverTitle, DEFAULT_COVER, listTitle, pointsLine } from "./cover";

describe("listTitle", () => {
  it("drops the points the GW app adds, however they're written", () => {
    expect(listTitle("Bear Force One (1995 points)")).toBe("Bear Force One");
    expect(listTitle("Expedition 33 (2,000 Points)")).toBe("Expedition 33");
    expect(listTitle("Turnajový list (1 985 Points)")).toBe("Turnajový list");
    // Brackets that aren't points stay.
    expect(listTitle("Dev go Brrrr (V.4) (2,000 Points)")).toBe("Dev go Brrrr (V.4)");
  });

  it("takes the first line: the rest is a description", () => {
    expect(listTitle("And they said Disruption is hardmode\nBut they forgot")).toBe(
      "And they said Disruption is hardmode",
    );
    expect(listTitle("Cause I’m coming\nI’m coming for you\nFull speed ahead(2,000 Points)")).toBe(
      "Cause I’m coming",
    );
  });

  it("is nothing for a list without a name", () => {
    expect(listTitle(undefined)).toBeUndefined();
    expect(listTitle("  (2,000 Points)")).toBeUndefined();
  });
});

describe("coverTitle", () => {
  const army = (note: string | undefined) =>
    ({ faction: "Adepta Sororitas", note, units: [] }) as unknown as Army;
  const named = { ...DEFAULT_COVER, name: "  Order of the Bloody Rose " };

  it("uses the list's own name over one you gave it", () => {
    expect(coverTitle(army("Sisters (2,000 Points)"), named)).toBe("Sisters");
    expect(coverTitle(army(undefined), named)).toBe("Order of the Bloody Rose");
    expect(coverTitle(army(undefined), DEFAULT_COVER)).toBeUndefined();
  });

  it("is nothing with the list name switched off", () => {
    expect(coverTitle(army(undefined), { ...named, listName: false })).toBeUndefined();
  });
});

describe("coverKey", () => {
  const army = (note: string | undefined) =>
    ({ faction: "Adepta Sororitas", note, units: [] }) as unknown as Army;

  it("stays the same when the list's points change", () => {
    expect(coverKey(army("Sisters (1,995 Points)"))).toBe(coverKey(army("Sisters (2,000 Points)")));
    expect(coverKey(army("Sisters"))).not.toBe(coverKey(army("Brothers")));
  });
});

describe("pointsLine", () => {
  it("names the battle size and the points spent", () => {
    const units = [{ points: 1000 }, { points: 995 }];
    const sized = { units, battleSize: { name: "Strike Force", points: 2000 } };
    expect(pointsLine(sized as unknown as Army)).toBe("Strike Force · 1,995 points");
    expect(pointsLine({ units } as unknown as Army)).toBe("1,995 points");
  });
});
