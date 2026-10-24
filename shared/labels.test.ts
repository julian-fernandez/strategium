import { describe, expect, it } from "vitest";
import { duplicateNumbers, unitLabel } from "./labels";
import type { Datasheet } from "./types";

function unit(id: string, name: string): Datasheet {
  return { id, name } as Datasheet;
}

describe("duplicateNumbers", () => {
  const units = [
    unit("u1", "Morvenn Vahl"),
    unit("u2", "Paragon Warsuits"),
    unit("u3", "Immolator"),
    unit("u4", "Immolator"),
    unit("u5", "Paragon Warsuits"),
    unit("u6", "Paragon Warsuits"),
  ];
  const numbers = duplicateNumbers(units);

  it("numbers repeated names in list order and leaves unique names alone", () => {
    expect(units.map((u) => unitLabel(u, numbers))).toEqual([
      "Morvenn Vahl",
      "Paragon Warsuits #1",
      "Immolator #1",
      "Immolator #2",
      "Paragon Warsuits #2",
      "Paragon Warsuits #3",
    ]);
  });

  it("returns plain names when numbering is off", () => {
    expect(unitLabel(unit("u2", "Paragon Warsuits"), new Map())).toBe("Paragon Warsuits");
  });
});
