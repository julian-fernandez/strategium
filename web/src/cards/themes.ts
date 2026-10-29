/** Per-faction card colors. The header takes the faction's color, like the official cards. */
export type CardTheme = {
  header: string;
  /** Counts and highlights on the paper; dark enough to read on it. */
  accent: string;
};

/**
 * One color per faction, keyed by every name a list or catalogue uses for it
 * ("Imperial Agents" and "Agents of the Imperium"). Colors that are light in
 * the faction's own scheme (Imperial Fists yellow, White Scars white) are taken
 * darker, so white header text and paper accents stay readable.
 */
const FACTIONS: { names: string[]; header: string; accent?: string }[] = [
  // Imperium
  { names: ["Adepta Sororitas"], header: "#86191d" },
  { names: ["Adeptus Custodes"], header: "#7a5a1d", accent: "#7a5718" },
  { names: ["Adeptus Mechanicus"], header: "#7d2418" },
  { names: ["Agents of the Imperium", "Imperial Agents"], header: "#3a3f55" },
  { names: ["Astra Militarum"], header: "#4f5a2c" },
  { names: ["Adeptus Titanicus", "Titanicus"], header: "#5c4a2a" },
  { names: ["Grey Knights"], header: "#4c5a66" },
  { names: ["Imperial Knights"], header: "#2e4a8a" },
  { names: ["Space Marines", "Adeptus Astartes"], header: "#23466d" },
  { names: ["Black Templars"], header: "#2b2d30", accent: "#3b3d40" },
  { names: ["Blood Angels"], header: "#8e1b1b" },
  { names: ["Dark Angels"], header: "#1f4a2c", accent: "#245a34" },
  { names: ["Deathwatch"], header: "#33373d" },
  { names: ["Imperial Fists"], header: "#8a6a12", accent: "#7a5c0c" },
  { names: ["Iron Hands"], header: "#3a3d40" },
  { names: ["Raven Guard"], header: "#2a2c33" },
  { names: ["Salamanders"], header: "#1f5a32" },
  { names: ["Space Wolves"], header: "#4a6278" },
  { names: ["Ultramarines"], header: "#1f3f7a" },
  { names: ["White Scars"], header: "#7a2a24" },
  // Chaos
  { names: ["Chaos Space Marines", "Heretic Astartes"], header: "#4a1f1f" },
  { names: ["Chaos Daemons", "Legiones Daemonica"], header: "#6a1838" },
  { names: ["Chaos Knights"], header: "#3d2b28" },
  { names: ["Death Guard"], header: "#55602a" },
  { names: ["Emperor's Children"], header: "#6a2a6e" },
  { names: ["Thousand Sons"], header: "#1e4a7a" },
  { names: ["World Eaters"], header: "#8a2418" },
  { names: ["Titanicus Traitoris"], header: "#4a2a2a" },
  // Xenos
  { names: ["Aeldari", "Craftworlds", "Asuryani"], header: "#1f5560" },
  { names: ["Drukhari"], header: "#3d1f4a" },
  { names: ["Genestealer Cults"], header: "#5a3a6e" },
  { names: ["Leagues of Votann"], header: "#8a4a1a", accent: "#7a3f12" },
  { names: ["Necrons"], header: "#2d5a3a" },
  { names: ["Orks"], header: "#3f5b22", accent: "#4a6b26" },
  { names: ["T'au Empire"], header: "#7b5a2e" },
  { names: ["Tyranids"], header: "#5a2a5e" },
];

export const DEFAULT_THEME: CardTheme = { header: "#3b4e5e", accent: "#3b4e5e" };

const THEMES = new Map<string, CardTheme>(
  FACTIONS.flatMap(({ names, header, accent }) =>
    names.map((name) => [themeKey(name), { header, accent: accent ?? header }] as const),
  ),
);

/** A faction's theme, by its list name or catalogue name ("Imperium - Adepta Sororitas"). */
export function themeFor(faction: string): CardTheme {
  return THEMES.get(themeKey(faction)) ?? DEFAULT_THEME;
}

function themeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(?:imperium|chaos|aeldari|xenos)\s+-\s+/, "")
    .replace(/[’']/g, "'")
    .trim();
}
