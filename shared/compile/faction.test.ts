import { describe, expect, it } from "vitest";
import type { BsNode } from "../bsdata/catalogues";
import type { Ability } from "../types";
import { profileHtml, pushAbility, weaponKind } from "./faction";

function profile(name: string, typeName: string, fields: Record<string, string>): BsNode {
  return {
    name,
    typeName,
    characteristics: Object.entries(fields).map(([field, $text]) => ({ name: field, $text })),
  } as BsNode;
}

describe("profileHtml", () => {
  it("reads the text from whatever one field holds it", () => {
    expect(profileHtml(profile("Orders", "Orders", { Orders: "Issue 1 Order." }))).toBe(
      "Issue 1 Order.",
    );
    expect(profileHtml(profile("Rhino", "Transport", { Capacity: "12 **INFANTRY** models" }))).toBe(
      "12 <b>INFANTRY</b> models",
    );
  });

  it("labels each field of a split profile, but not its description", () => {
    expect(
      profileHtml(
        profile("Calistus", "Martial Ka'tah", {
          When: "Your Movement phase",
          Target: "That unit",
          Effect: "It can move.",
        }),
      ),
    ).toBe(
      "<b>When:</b> Your Movement phase<br><b>Target:</b> That unit<br><b>Effect:</b> It can move.",
    );
    expect(
      profileHtml(profile("Litany", "Hymn of Battle", { Description: 'Add 2".', D6: "1" })),
    ).toBe("Add 2&quot;.<br><b>D6:</b> 1");
  });
});

describe("pushAbility", () => {
  const labels = (...profiles: BsNode[]) => {
    const list: Ability[] = [];
    for (const p of profiles) pushAbility(list, p);
    return list.map((ability) => ability.name);
  };

  it("keeps a plain ability's name and prefixes other types", () => {
    expect(
      labels(
        profile("Wall of Muscle", "Abilities", { Description: "x" }),
        profile("Diseased Influence", "Lord of the Death Guard", { Effect: "x" }),
      ),
    ).toEqual(["Wall of Muscle", "Lord of the Death Guard: Diseased Influence"]);
  });

  it("names Orders and a transport by their type alone, once", () => {
    expect(
      labels(
        profile("Orders", "Orders", { Orders: "x" }),
        profile("Orders", "Orders", { Orders: "x" }),
        profile("Hekaton Land Fortress", "Transport", { Capacity: "x" }),
      ),
    ).toEqual(["Orders", "Transport"]);
  });
});

describe("weaponKind", () => {
  it("knows a weapon filed under its own type by its columns", () => {
    const columns = {
      Range: '18"',
      A: "3D6",
      BS: "N/A",
      S: "6",
      AP: "-2",
      D: "1",
      Keywords: "Torrent",
    };
    expect(weaponKind(profile("Cosmic fire", "C'tan Powers", columns))).toBe("ranged");
    expect(weaponKind(profile("Claws", "Odd Type", { ...columns, Range: "Melee" }))).toBe("melee");
    expect(weaponKind(profile("Bolter", "Ranged Weapons", {}))).toBe("ranged");
    expect(weaponKind(profile("Orders", "Orders", { Orders: "x" }))).toBeUndefined();
  });
});
