import { describe, expect, it } from "vitest";
import type { Army, Datasheet, Stratagem, WeaponRow } from "../../../shared/types";
import {
  buildDeck,
  DEFAULT_DECK_OPTIONS,
  type DeckOptions,
  type DeckPage,
  impose,
  paginate,
  splitSections,
  wargearParts,
} from "./printOrder";

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
  it("prints a leader on the standard datasheet behind its unit, and blank backs for the rest", () => {
    expect(kinds()).toEqual([
      "datasheet:u2",
      // The Canoness's own full datasheet, on the Zephyrim's back.
      "datasheet:u1",
      "datasheet:u3",
      "blank:",
      "datasheet:u4",
      "blank:",
      "stratagems:",
      "blank:",
    ]);
  });

  it("prints no blank backs single-sided", () => {
    expect(kinds({ ...UNITS_ONLY, duplex: false })).toEqual([
      "datasheet:u2",
      "datasheet:u1",
      "datasheet:u3",
      "datasheet:u4",
      "stratagems:",
    ]);
  });

  it("gives characters their own sheets when leaders don't go on the bodyguard", () => {
    expect(kinds({ ...UNITS_ONLY, leaders: "own" }).slice(0, 4)).toEqual([
      "datasheet:u1",
      "blank:",
      "datasheet:u2",
      "blank:",
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

  it("puts a cover first, with the army rules on its back", () => {
    const covered = { ...DEFAULT_DECK_OPTIONS, cover: true };
    // The cover takes the army rules card's blank back: no more sheets than without it.
    expect(kinds(covered).slice(0, 3)).toEqual(["cover:", "army-rules:", "datasheet:u2"]);
    expect(kinds(covered).length).toBe(kinds(DEFAULT_DECK_OPTIONS).length);
    // Without the army rules card the cover gets a blank back; single-sided, none.
    expect(kinds({ ...covered, armyRules: false }).slice(0, 3)).toEqual([
      "cover:",
      "blank:",
      "datasheet:u2",
    ]);
    expect(kinds({ ...covered, duplex: false }).slice(0, 3)).toEqual([
      "cover:",
      "army-rules:",
      "datasheet:u2",
    ]);
  });

  it("gives army rules pages after the first a sheet each, behind a cover too", () => {
    const long = {
      ...army,
      armyRules: {
        ...army.armyRules,
        detachments: ["One", "Two", "Three"].map((name) => ({
          name,
          rules: [{ name, html: "x".repeat(4000) }],
        })),
      },
    } as Army;
    const pages = buildDeck(long, { ...DEFAULT_DECK_OPTIONS, cover: true }).map((p) => p.kind);
    expect(pages.slice(0, 6)).toEqual([
      "cover",
      "army-rules",
      "army-rules",
      "blank",
      "army-rules",
      "blank",
    ]);
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

describe("leaders facing their unit", () => {
  const FACING: DeckOptions = { ...UNITS_ONLY, leaders: "facing" };

  it("puts the unit on a back and its leader on the next front, taking a blank back", () => {
    const leaderLast = {
      ...army,
      units: [army.units[2], army.units[3], army.units[1], army.units[0]],
    } as Army;
    const pages = buildDeck(leaderLast, FACING).map(
      (page) => `${page.kind}:${"unit" in page ? page.unit.id : ""}`,
    );
    // Mortifiers and the Servitor on their own sheets; the Zephyrim take the Servitor's
    // blank back, so the Canoness on the next front faces them.
    expect(pages.slice(0, 6)).toEqual([
      "datasheet:u3",
      "blank:",
      "datasheet:u4",
      "datasheet:u2",
      "datasheet:u1",
      "blank:",
    ]);
    // Every unit's back (odd index) faces the next front.
    expect(pages.indexOf("datasheet:u2") % 2).toBe(1);
    expect(pages.indexOf("datasheet:u1") % 2).toBe(0);
  });

  it("leaves a front blank when nothing blank comes before the unit", () => {
    // The Zephyrim come first: page one is a front, so it stays blank.
    expect(kinds(FACING).slice(0, 4)).toEqual(["blank:", "datasheet:u2", "datasheet:u1", "blank:"]);
  });

  it("prints leaders right after their unit single-sided", () => {
    expect(kinds({ ...FACING, duplex: false }).slice(0, 2)).toEqual([
      "datasheet:u2",
      "datasheet:u1",
    ]);
  });
});

describe("the stratagem deck", () => {
  const many = {
    ...army,
    stratagems: Array.from({ length: 9 }, (_, i) => stratagem(`s${i}`, ["Mortifiers"])),
  } as Army;
  const deck = (options: DeckOptions) =>
    buildDeck(many, options)
      .map((page) => page.kind)
      .filter((kind, index, all) => kind === "stratagems" || all[index - 1] === "stratagems");

  it("backs its pages onto each other, with one blank to finish the sheet", () => {
    // Nine stratagems, four to a page: three pages, the last sheet's back blank.
    expect(deck(UNITS_ONLY)).toEqual(["stratagems", "stratagems", "stratagems", "blank"]);
  });
});

describe("splitSections", () => {
  const rule = (name: string) => ({ name, html: "x".repeat(200) });

  it("keeps a section that fits, and breaks one that doesn't between its rules", () => {
    const sections = [
      { title: "Army rule", rules: [rule("Acts of Faith")] },
      { title: "Enhancements", rules: ["A", "B", "C", "D", "E"].map(rule) },
    ];
    // A rule costs 261 and a section title 80, so a 700 budget takes two rules to a page.
    expect(
      splitSections(sections, 700).map((s) => `${s.title}: ${s.rules.map((r) => r.name)}`),
    ).toEqual([
      "Army rule: Acts of Faith",
      "Enhancements: A,B",
      "Enhancements, continued: C,D",
      "Enhancements, continued: E",
    ]);
  });
});

describe("paginate", () => {
  const sizes = (pages: number[][]) => pages.map((page) => page.join("+"));

  it("packs items in order and starts a page when the next would overflow", () => {
    expect(sizes(paginate([3, 4, 2, 5, 1], (n) => n, 7))).toEqual(["3+4", "2+5", "1"]);
  });

  it("spreads items evenly over the pages it needs", () => {
    // Packed greedily these would be 4+4+4+4 and a lone 4.
    expect(sizes(paginate([4, 4, 4, 4, 4], (n) => n, 16))).toEqual(["4+4+4", "4+4"]);
  });

  it("gives an item bigger than a page a page of its own", () => {
    expect(sizes(paginate([2, 9, 2], (n) => n, 7))).toEqual(["2", "9", "2"]);
  });

  it("makes no pages from nothing", () => {
    expect(paginate([], (n: number) => n, 7)).toEqual([]);
  });
});

describe("impose", () => {
  const page = (key: string) => ({ kind: "blank", key }) as DeckPage;
  const four = ["1f", "1b", "2f", "2b", "3f", "3b"].map(page);
  const keys = (side?: (DeckPage | undefined)[]) => side?.map((p) => p?.key ?? "-");

  it("puts one page on each side of an A5 sheet", () => {
    const sheets = impose(four, { duplex: true, paper: "a5", binding: "none" });
    expect(sheets.map((s) => [keys(s.front), keys(s.back)])).toEqual([
      [["1f"], ["1b"]],
      [["2f"], ["2b"]],
      [["3f"], ["3b"]],
    ]);
  });

  it("stacks two A5 sheets on each A4 sheet, each back right behind its front", () => {
    const sheets = impose(four, { duplex: true, paper: "a4", binding: "left" });
    expect(sheets.map((s) => [keys(s.front), keys(s.back)])).toEqual([
      [
        ["1f", "2f"],
        ["1b", "2b"],
      ],
      [
        ["3f", "-"],
        ["3b", "-"],
      ],
    ]);
  });

  it("swaps an A4 sheet's backs when it turns over its short edge, for a top binding", () => {
    const sheets = impose(four, { duplex: true, paper: "a4", binding: "top" });
    expect(keys(sheets[0]?.back)).toEqual(["2b", "1b"]);
    expect(keys(sheets[1]?.back)).toEqual(["-", "3b"]);
  });

  it("fills A4 sides in order single-sided", () => {
    const sheets = impose(four, { duplex: false, paper: "a4", binding: "none" });
    expect(sheets.map((s) => keys(s.front))).toEqual([
      ["1f", "1b"],
      ["2f", "2b"],
      ["3f", "3b"],
    ]);
    expect(sheets.every((s) => s.back === undefined)).toBe(true);
  });
});

describe("full datasheets", () => {
  const armed = (id: string, name: string, attachment?: Datasheet["attachment"]) =>
    ({
      ...unit(id, name, attachment),
      otherRanged: [{ name: "Heavy bolter", count: 0, profiles: [] }],
    }) as Datasheet;
  const withWargear = {
    ...army,
    units: [
      armed("u1", "Canoness", { role: "leader", group: 1 }),
      armed("u2", "Zephyrim Squad", { role: "bodyguard", group: 1 }),
      armed("u3", "Mortifiers"),
      unit("u4", "Lonely Servitor"),
    ],
  } as Army;
  const FULL: DeckOptions = { ...UNITS_ONLY, fullDatasheets: true };
  const pages = (options: DeckOptions) =>
    buildDeck(withWargear, options).map(
      (page) => `${page.kind}:${"unit" in page ? page.unit.id : ""}`,
    );

  it("puts a unit's wargear page on its back, and a group's after the group", () => {
    expect(pages(FULL).slice(0, 8)).toEqual([
      "datasheet:u2",
      "datasheet:u1",
      "wargear:u2",
      "wargear:u1",
      "datasheet:u3",
      "wargear:u3",
      // Nothing else to take: no wargear page, a blank back as before.
      "datasheet:u4",
      "blank:",
    ]);
  });

  it("faces the unit's and its leader's wargear pages on the next spread", () => {
    const facing = pages({ ...FULL, leaders: "facing" });
    const at = (key: string) => facing.indexOf(key);
    expect(at("datasheet:u2") % 2).toBe(1);
    expect(at("datasheet:u1")).toBe(at("datasheet:u2") + 1);
    expect(at("wargear:u2") % 2).toBe(1);
    expect(at("wargear:u1")).toBe(at("wargear:u2") + 1);
  });

  it("adds nothing with the option off", () => {
    expect(pages(UNITS_ONLY).some((page) => page.startsWith("wargear"))).toBe(false);
  });
});

describe("wargearParts", () => {
  const row = (name: string) => ({ name, count: 0, profiles: [{ name }] }) as WeaponRow;
  const sheet = (weapons: number, options: string[] = []) =>
    ({
      otherRanged: Array.from({ length: weapons }, (_, i) => row(`Gun ${i}`)),
      wargearOptions: options,
    }) as unknown as Datasheet;

  it("fits a short list on one page, and has none for a unit with nothing else to take", () => {
    expect(wargearParts(sheet(8, ["One option."]))).toHaveLength(1);
    expect(wargearParts(sheet(0))).toEqual([]);
  });

  it("spreads a long list evenly over the pages it needs, weapons first", () => {
    const parts = wargearParts(sheet(80, ["The last option."]));
    expect(parts.length).toBe(3);
    expect(parts.map((part) => part.length).every((length) => length >= 25)).toBe(true);
    expect(parts.at(-1)?.at(-1)).toEqual({ kind: "option", html: "The last option." });
  });

  it("adds the pages a spilling unit was given, up to a limit", () => {
    expect(wargearParts(sheet(8), 1)).toHaveLength(2);
    expect(wargearParts(sheet(8), 20).length).toBeLessThanOrEqual(6);
  });
});
