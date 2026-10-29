import { describe, expect, it } from "vitest";
import type { Army, Datasheet, Stratagem } from "../../../shared/types";
import { buildDeck, DEFAULT_DECK_OPTIONS, type DeckOptions, paginate } from "./printOrder";

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
  armyRules: {
    rules: [{ name: "Acts of Faith", html: "" }],
    detachments: [{ name: "Champions of Faith", rules: [{ name: "Righteous Purpose", html: "" }] }],
    enhancements: [],
  },
  glossary: [
    { name: "Acts of Faith", html: "" },
    { name: "Deep Strike", html: "" },
    { name: "Leader", html: "" },
  ],
} as unknown as Army;

/** The unit pages alone; the army rules card and the reference have their own tests. */
const UNITS_ONLY: DeckOptions = { ...DEFAULT_DECK_OPTIONS, armyRules: false, glossary: false };

const kinds = (options = UNITS_ONLY) =>
  buildDeck(army, options).map((page) => `${page.kind}:${"unit" in page ? page.unit.id : ""}`);

describe("buildDeck", () => {
  it("prints a leader on the standard datasheet behind its unit, then their stratagems", () => {
    expect(kinds()).toEqual([
      "datasheet:u2",
      // The Canoness's own full datasheet, on the Zephyrim's back.
      "datasheet:u1",
      "unit-back:u2",
      "blank:",
      "datasheet:u3",
      "unit-back:u3",
      // Nothing it can use: the back stays blank.
      "datasheet:u4",
      "blank:",
      "stratagems:",
      "blank:",
    ]);
  });

  it("prints no lone-unit backs single-sided, but keeps an attached unit's stratagems", () => {
    expect(kinds({ ...UNITS_ONLY, duplex: false })).toEqual([
      "datasheet:u2",
      "datasheet:u1",
      "unit-back:u2",
      "datasheet:u3",
      "datasheet:u4",
      "stratagems:",
    ]);
  });

  it("leaves out every unit stratagem card when they're turned off, keeping sheets paired", () => {
    expect(kinds({ ...UNITS_ONLY, unitStratagems: false })).toEqual([
      "datasheet:u2",
      "datasheet:u1",
      "datasheet:u3",
      "blank:",
      "datasheet:u4",
      "blank:",
      "stratagems:",
      "blank:",
    ]);
  });

  it("gives characters their own backs when leaders don't go on the bodyguard", () => {
    expect(kinds({ ...UNITS_ONLY, leadersOnBack: false }).slice(0, 4)).toEqual([
      "datasheet:u1",
      "unit-back:u1",
      "datasheet:u2",
      "unit-back:u2",
    ]);
  });

  it("opens with the army rules card and closes with the rules reference", () => {
    const pages = kinds(DEFAULT_DECK_OPTIONS);
    expect(pages.slice(0, 2)).toEqual(["army-rules:", "blank:"]);
    // Every page pair is one sheet: fronts on even pages.
    expect(pages.length % 2).toBe(0);
    // One reference page: double-sided it still gets a blank back.
    expect(pages.slice(-2)).toEqual(["glossary:", "blank:"]);
    expect(kinds({ ...DEFAULT_DECK_OPTIONS, duplex: false }).at(-1)).toBe("glossary:");
  });

  it("leaves the army rule out of the reference only when the army rules card prints it", () => {
    const reference = (options: DeckOptions) =>
      buildDeck(army, options).flatMap((page) =>
        page.kind === "glossary" ? page.rules.map((r) => r.name) : [],
      );
    expect(reference(DEFAULT_DECK_OPTIONS)).toEqual(["Deep Strike", "Leader"]);
    expect(reference({ ...DEFAULT_DECK_OPTIONS, armyRules: false })).toEqual([
      "Acts of Faith",
      "Deep Strike",
      "Leader",
    ]);
  });
});

describe("paginate", () => {
  const sizes = (pages: number[][]) => pages.map((page) => page.join("+"));

  it("packs items in order and starts a page when the next would overflow", () => {
    expect(sizes(paginate([3, 4, 2, 5, 1], (n) => n, 7))).toEqual(["3+4", "2+5", "1"]);
  });

  it("gives an item bigger than a page a page of its own", () => {
    expect(sizes(paginate([2, 9, 2], (n) => n, 7))).toEqual(["2", "9", "2"]);
  });

  it("makes no pages from nothing", () => {
    expect(paginate([], (n: number) => n, 7)).toEqual([]);
  });
});
