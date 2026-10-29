import { describe, expect, it } from "vitest";
import type { Army, Datasheet, Stratagem } from "../../../shared/types";
import { buildDeck, DEFAULT_DECK_OPTIONS } from "./printOrder";

function unit(id: string, name: string, attachment?: Datasheet["attachment"]): Datasheet {
  return { id, name, attachment } as Datasheet;
}

function stratagem(id: string, usableBy: string[]): Stratagem {
  return { id, name: id, usableBy } as Stratagem;
}

const army = {
  units: [
    unit("u1", "Canoness", { role: "leader", group: 1 }),
    unit("u2", "Zephyrim Squad", { role: "bodyguard", group: 1 }),
    unit("u3", "Mortifiers"),
    unit("u4", "Lonely Servitor"),
  ],
  groups: [{ id: 1, bodyguardId: "u2", characterIds: ["u1"], stratagemIds: ["s1"] }],
  stratagems: [stratagem("s1", ["Canoness", "Zephyrim Squad", "Mortifiers"]), stratagem("s2", [])],
} as unknown as Army;

const kinds = (options = DEFAULT_DECK_OPTIONS) =>
  buildDeck(army, options).map((page) => `${page.kind}:${"unit" in page ? page.unit.id : ""}`);

describe("buildDeck", () => {
  it("gives a lone unit its own stratagems on the back when printing double-sided", () => {
    expect(kinds()).toEqual([
      "datasheet:u2",
      "back:",
      "datasheet:u3",
      "unit-back:u3",
      // Nothing it can use: the back stays blank.
      "datasheet:u4",
      "blank:",
      "stratagems:",
      "blank:",
    ]);
  });

  it("prints no unit backs single-sided", () => {
    expect(kinds({ ...DEFAULT_DECK_OPTIONS, duplex: false })).toEqual([
      "datasheet:u2",
      "back:",
      "datasheet:u3",
      "datasheet:u4",
      "stratagems:",
    ]);
  });

  it("gives characters their own backs when leaders don't go on the bodyguard", () => {
    expect(kinds({ ...DEFAULT_DECK_OPTIONS, leadersOnBack: false }).slice(0, 4)).toEqual([
      "datasheet:u1",
      "unit-back:u1",
      "datasheet:u2",
      "unit-back:u2",
    ]);
  });
});
