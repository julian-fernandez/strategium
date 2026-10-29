/**
 * Pieces every text format shares: cleaning up pasted text, reading points
 * in any locale, battle sizes, and the WTC "+++" header block that tournament
 * exports (and many pasted lists) put on top.
 */

/** Pasted text, tidied: LF line endings, plain spaces, ASCII parentheses and "x" counts. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[   　]/g, " ")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/×/g, "x");
}

/** The words exports use for points, in every language the official app ships. */
export const POINTS_WORD = "(?:points?|pts|pt|punkte|puntos|punti|ポイント|포인트)";

/** "2,000", "1.995", "2 000" and "2000" are all 2000. */
export function toPoints(value: string | undefined): number {
  return Number((value ?? "").replace(/[^\d]/g, "")) || 0;
}

const SIZES = [
  { name: "Incursion", points: 1000 },
  { name: "Strike Force", points: 2000 },
  { name: "Onslaught", points: 3000 },
];

/**
 * A battle size from its name in any language or just its points; with only an
 * army's total, the smallest size it fits.
 */
export function battleSize(points: number, name?: string): { name: string; points: number } {
  const byName = SIZES.find((size) => name && new RegExp(size.name, "i").test(name));
  if (byName) return { ...byName, points: points || byName.points };
  const fits = SIZES.find((size) => points <= size.points);
  return { name: fits?.name ?? name ?? "Strike Force", points: fits?.points ?? points };
}

/** The five force dispositions; lists name them on a line of their own or after a label. */
export const DISPOSITIONS = [
  "Take and Hold",
  "Purge the Foe",
  "Priority Assets",
  "Reconnaissance",
  "Disruption",
];

export type WtcHeader = {
  faction?: string;
  detachments?: string;
  disposition?: string;
  totalPoints?: number;
  battleSize?: { name: string; points: number };
  warlord?: string;
  /** "Destroyer Ankh (on Char6: Overlord)": enhancement and the unit it's on. */
  enhancements: { name: string; on: string; cost?: number }[];
};

const WTC_LINE = /^[+&]\s*([A-Z][A-Za-z ()'’/]*?)\s*:\s*(.*)$/;

/**
 * The WTC header block: "+ FACTION KEYWORD: Xenos - Necrons", "+ DETACHMENT: …",
 * "+ ENHANCEMENT: X (on Char6: Overlord)" with "& Y (on …)" continuations, and
 * the like. Returns undefined when the text has no such block.
 */
export function parseWtcHeader(lines: string[]): WtcHeader | undefined {
  const header: WtcHeader = { enhancements: [] };
  let found = false;
  let field = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!/^[+&]/.test(line)) continue;
    const match = WTC_LINE.exec(line);
    if (match) {
      found = true;
      field = (match[1] ?? "").toUpperCase();
    }
    const value = (match ? match[2] : line.replace(/^[+&]\s*/, ""))?.trim() ?? "";
    if (!value) continue;
    if (/FACTION/.test(field)) header.faction ??= value;
    else if (/DETACHMENT/.test(field)) header.detachments = value.replace(/\s*\([^)]*\)\s*$/, "");
    else if (/DISPOSITION/.test(field)) header.disposition = value;
    else if (/ARMY POINTS|^POINTS/.test(field)) header.totalPoints = toPoints(value);
    else if (/BATTLE SIZE/.test(field)) {
      const size = /\((\d[\d.,\s]*)/.exec(value);
      header.battleSize = battleSize(toPoints(size?.[1]), value);
    } else if (/WARLORD/.test(field)) header.warlord = value.replace(/^\w+\d+:\s*/, "");
    else if (/ENHANCEMENT/.test(field)) {
      for (const part of value.split(/\s*&\s*/)) {
        const enhancement = /^(.+?)\s*\(on\s+(?:\w+\d+:\s*)?(.+?)\)\s*$/i.exec(part);
        if (enhancement) {
          header.enhancements.push({ name: enhancement[1] ?? "", on: enhancement[2] ?? "" });
        }
      }
    }
  }
  return found ? header : undefined;
}
