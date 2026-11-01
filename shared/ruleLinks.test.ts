import { describe, expect, it } from "vitest";
import { linkRules, namePattern, type RuleIndex } from "./ruleLinks";

const known: Record<string, string> = {
  "assault shooting": "core:10.05",
  "critical hit": "core:hit roll",
  "devastating wounds": "rule:devastating wounds",
};
const resolve = (name: string, section?: string) =>
  section ? `core:${section}` : known[name.toLowerCase()];
const index: RuleIndex = { resolve };

/** The army's rules and the core terms, each name filed the way the app files it. */
const army: Record<string, string> = {
  "lethal hits": "rule:lethal hits",
  "sustained hits": "rule:sustained hits",
  "feel no pain": "rule:feel no pain",
  anti: "rule:anti",
  scouts: "rule:scouts",
  assault: "rule:assault",
};
const core: Record<string, string> = {
  "charge move": "core:charge move",
  "fall back": "core:fall back",
  "battle shock test": "core:battle shock",
  advance: "core:advance",
  hidden: "core:hidden",
};
const plain: RuleIndex = {
  resolve: (name) => {
    const key = name
      .toLowerCase()
      .replace(/^anti-.*$/, "anti")
      .replace(/\s+(?:d?\d+)\+?$/, "")
      .replace(/-/g, " ");
    return army[key] ?? core[key];
  },
  names: namePattern(Object.keys(army)),
  terms: namePattern(Object.keys(core)),
};
const button = (id: string, text: string) =>
  `<button type="button" class="rule-term" data-rule="${id}">${text}</button>`;

describe("linkRules", () => {
  it("links a bold term, by the section number after it when there is one", () => {
    expect(linkRules("Shoot using <b>assault shooting</b> (10.05).", index)).toBe(
      `Shoot using <b>${button("core:10.05", "assault shooting")}</b> (10.05).`,
    );
    expect(linkRules("Results in a <b>critical hit</b>.", index)).toBe(
      `Results in a <b>${button("core:hit roll", "critical hit")}</b>.`,
    );
  });

  it("links a weapon keyword in brackets, bold or not", () => {
    expect(linkRules("Abilities such as [DEVASTATING WOUNDS].", index)).toBe(
      `Abilities such as [${button("rule:devastating wounds", "DEVASTATING WOUNDS")}].`,
    );
    expect(linkRules("A <b>[DEVASTATING WOUNDS]</b> weapon.", index)).toBe(
      `A <b>${button("rule:devastating wounds", "[DEVASTATING WOUNDS]")}</b> weapon.`,
    );
  });

  it("leaves alone what it doesn't know, short labels, and the rule being read", () => {
    expect(linkRules("<b>WHEN:</b> Now. <b>D</b> is damage.", index)).toBe(
      "<b>WHEN:</b> Now. <b>D</b> is damage.",
    );
    expect(linkRules("A <b>critical hit</b>.", index, "core:hit roll")).toBe(
      "A <b>critical hit</b>.",
    );
  });

  it("links rules named in plain text, with their numbers", () => {
    expect(
      linkRules(
        "select one:<br>- Sustained Hits 1<br>- Lethal Hits<br><br>If this unit made a Charge move",
        plain,
      ),
    ).toBe(
      `select one:<br>- ${button("rule:sustained hits", "Sustained Hits 1")}<br>- ${button("rule:lethal hits", "Lethal Hits")}<br><br>If this unit made a ${button("core:charge move", "Charge move")}`,
    );
    expect(linkRules("It has Feel No Pain 5+ and Anti-Infantry 4+.", plain)).toBe(
      `It has ${button("rule:feel no pain", "Feel No Pain 5+")} and ${button("rule:anti", "Anti-Infantry 4+")}.`,
    );
    expect(linkRules("it can Fall Back and take a Battle-shock test", plain)).toBe(
      `it can ${button("core:fall back", "Fall Back")} and take a ${button("core:battle shock", "Battle-shock test")}`,
    );
  });

  it("leaves plain words alone: lower case, keywords, longer names, a sentence's first word", () => {
    for (const text of [
      "it has lethal hits",
      "ADEPTA SORORITAS ASSAULT units",
      "Assault Intercessors and Wolf Scouts",
      "Hidden units. Advance now.",
    ]) {
      expect(linkRules(text, plain)).toBe(text);
    }
    expect(linkRules("When Lethal Hits applies, it can Advance", plain)).toBe(
      `When ${button("rule:lethal hits", "Lethal Hits")} applies, it can ${button("core:advance", "Advance")}`,
    );
  });

  it("doesn't link inside a link, or the rule being read", () => {
    expect(linkRules("<b>Lethal Hits</b> as Lethal Hits", plain, "rule:lethal hits")).toBe(
      "<b>Lethal Hits</b> as Lethal Hits",
    );
    const once = linkRules("[LETHAL HITS] with <b>Charge move</b>", {
      ...plain,
      resolve: (name) => (name === "LETHAL HITS" ? "rule:lethal hits" : plain.resolve(name)),
    });
    expect(once).toBe(
      `[${button("rule:lethal hits", "LETHAL HITS")}] with <b>${button("core:charge move", "Charge move")}</b>`,
    );
  });
});
