import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, themeFor } from "./themes";

/** Every playable catalogue in BSData's wh40k-11e, as of the October 2026 sync. */
const CATALOGUES = [
  "Aeldari - Craftworlds",
  "Aeldari - Drukhari",
  "Chaos - Chaos Daemons",
  "Chaos - Chaos Knights",
  "Chaos - Chaos Space Marines",
  "Chaos - Death Guard",
  "Chaos - Emperor's Children",
  "Chaos - Thousand Sons",
  "Chaos - Titanicus Traitoris",
  "Chaos - World Eaters",
  "Genestealer Cults",
  "Imperium - Adepta Sororitas",
  "Imperium - Adeptus Custodes",
  "Imperium - Adeptus Mechanicus",
  "Imperium - Adeptus Titanicus",
  "Imperium - Agents of the Imperium",
  "Imperium - Astra Militarum",
  "Imperium - Black Templars",
  "Imperium - Blood Angels",
  "Imperium - Dark Angels",
  "Imperium - Deathwatch",
  "Imperium - Grey Knights",
  "Imperium - Imperial Fists",
  "Imperium - Imperial Knights",
  "Imperium - Iron Hands",
  "Imperium - Raven Guard",
  "Imperium - Salamanders",
  "Imperium - Space Marines",
  "Imperium - Space Wolves",
  "Imperium - Ultramarines",
  "Imperium - White Scars",
  "Leagues of Votann",
  "Necrons",
  "Orks",
  "T'au Empire",
  "Tyranids",
];

/** WCAG contrast ratio between two hex colors. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe("themeFor", () => {
  it.each(CATALOGUES)("has a theme for %s", (catalogue) => {
    expect(themeFor(catalogue)).not.toBe(DEFAULT_THEME);
  });

  it("matches the names lists use as well as catalogue names", () => {
    expect(themeFor("Imperial Agents")).toEqual(themeFor("Imperium - Agents of the Imperium"));
    expect(themeFor("Aeldari")).toEqual(themeFor("Aeldari - Craftworlds"));
    expect(themeFor("Emperor’s Children")).toEqual(themeFor("Chaos - Emperor's Children"));
  });

  it.each(CATALOGUES)("keeps white header text and paper accents readable for %s", (catalogue) => {
    const theme = themeFor(catalogue);
    expect(contrast(theme.header, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accent, "#efece3")).toBeGreaterThanOrEqual(4.5);
  });
});
