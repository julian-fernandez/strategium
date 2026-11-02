import { describe, expect, it } from "vitest";
import { type BsNode, Catalogues } from "./catalogues";

const pts = (value: number) => [{ name: "pts", typeId: "pts", value }];

/** A shared Multi-melta, free on its own, and the links a unit prices it on. */
const catalogues = new Catalogues([
  {
    name: "Faction",
    isGameSystem: false,
    root: {
      sharedSelectionEntries: [
        { id: "melta", name: "Multi-melta", type: "upgrade" },
        { id: "cannon", name: "Battle cannon", type: "upgrade", costs: pts(10) },
      ],
    } as BsNode,
  },
]);

describe("Catalogues.resolve", () => {
  it("keeps the points a link puts on its target", () => {
    const link = { name: "Multi-melta", targetId: "melta", costs: pts(5) } as BsNode;
    expect(catalogues.points(catalogues.resolve(link))).toBe(5);
  });

  it("adds a link's points to the target's own, and leaves a link without any at the target's", () => {
    expect(
      catalogues.points(catalogues.resolve({ targetId: "cannon", costs: pts(5) } as BsNode)),
    ).toBe(15);
    expect(catalogues.points(catalogues.resolve({ targetId: "cannon" } as BsNode))).toBe(10);
    expect(catalogues.points(catalogues.resolve({ targetId: "melta" } as BsNode))).toBe(0);
  });
});
