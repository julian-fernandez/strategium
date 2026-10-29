/** Per-faction card colors. The header takes the faction's color, like the official cards. */
export type CardTheme = {
  header: string;
  accent: string;
};

const THEMES: Record<string, CardTheme> = {
  "adepta sororitas": { header: "#86191d", accent: "#86191d" },
  "adeptus custodes": { header: "#7a5a1d", accent: "#8a6420" },
  "blood angels": { header: "#8e1b1b", accent: "#8e1b1b" },
  "dark angels": { header: "#1f4a2c", accent: "#245a34" },
  "space marines": { header: "#23466d", accent: "#23466d" },
  necrons: { header: "#2d5a3a", accent: "#2d5a3a" },
  orks: { header: "#3f5b22", accent: "#4a6b26" },
  "t'au empire": { header: "#7b5a2e", accent: "#7b5a2e" },
  tyranids: { header: "#5a2a5e", accent: "#5a2a5e" },
};

const DEFAULT_THEME: CardTheme = { header: "#3b4e5e", accent: "#3b4e5e" };

export function themeFor(faction: string): CardTheme {
  return THEMES[faction.toLowerCase()] ?? DEFAULT_THEME;
}
