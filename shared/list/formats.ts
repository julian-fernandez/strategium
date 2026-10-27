import type { FactionBundle } from "../bundle";
import { detectFaction, findFaction } from "../factions";
import type { ListFormat } from "../types";
import { parseGuided } from "./guided";
import { parseGwText } from "./gw";
import { isRosterJson, isRosterXml, parseRosterJson, parseRosterXml } from "./roster";
import { cleanText, parseWtcHeader } from "./text";
import type { ArmyList } from "./types";

/**
 * Every export format the app reads, how to recognise each, and how to read
 * it. Footers are the surest sign; header shapes come next. Checked in order;
 * anything unrecognised is read as a free-form list.
 */
export type ListParser = {
  format: ListFormat;
  detect: (text: string) => boolean;
  /** Formats with a fixed grammar read on their own. */
  parse?: (text: string) => ArmyList;
  /** The rest are read against the faction's vocabulary. */
  guided?: (text: string, bundle: FactionBundle) => ArmyList;
};

const has = (pattern: RegExp) => (text: string) => pattern.test(text);
const guided = (text: string, bundle: FactionBundle) => parseGuided(text, bundle);

export const LIST_PARSERS: ListParser[] = [
  {
    format: { id: "image", label: "Image placeholder" },
    detect: has(/uploaded as an image/i),
    parse: () => {
      throw new Error("This list was uploaded as an image, so there's no text to read.");
    },
  },
  {
    format: { id: "roster-xml", label: "BattleScribe roster (.ros)" },
    detect: isRosterXml,
    parse: parseRosterXml,
  },
  {
    format: { id: "roster-json", label: "Roster JSON (New Recruit, ListForge)" },
    detect: isRosterJson,
    parse: parseRosterJson,
  },
  {
    format: { id: "nr-wtc-compact", label: "New Recruit WTC-Compact" },
    detect: has(/^\s*[A-Z][a-z]{2,4}\d+:\s*\d+x\s/m),
    guided,
  },
  {
    // The full WTC export: a WTC header over "1x Name (60 pts): gear" units.
    format: { id: "nr-wtc", label: "New Recruit WTC" },
    detect: (text) =>
      /^\+\s*FACTION KEYWORD\s*:/im.test(text) && /^\s*\d+x\s.+\(\d+\s*pts\)\s*:?/im.test(text),
    guided,
  },
  {
    format: { id: "gw-app", label: "Warhammer 40,000 app (or a copy of its export)" },
    detect: (text) =>
      /\(\s*\d+\s*(?:detachment points?|points? de détachement|kontingentspunkte|puntos de destacamento|punti(?: di)? distaccamento|デタッチメントポイント|디태치먼트 포인트)\s*\)/iu.test(
        text,
      ) ||
      /^\s*•\s*(?:attached as|angeschlossen als|adjunta como|attachée? en tant que|aggregata come)\s*:/imu.test(
        text,
      ) ||
      /exported with (?:app version|new recruit|battlebase)/i.test(text),
    parse: parseGwText,
  },
  { format: { id: "wtc", label: "WTC" }, detect: has(/^\+\s*FACTION KEYWORD\s*:/im), guided },
  {
    format: { id: "nr-text", label: "New Recruit" },
    detect: has(/# \+\+ Army Roster \+\+|^.+ - \[\d+ pts\]\s*$|created with newrecruit/im),
    guided,
  },
  {
    format: { id: "listforge", label: "ListForge" },
    detect: has(/listforge|^.+ - .+ \(\d+ Points\)\s*$|Factions Used:/im),
    guided: (text, bundle) =>
      // The short and simple exports put the number of duplicate units up front ("2x10 Jakhals").
      parseGuided(text, bundle, { duplicates: !/attached units:|^[•·]/im.test(text) }),
  },
  { format: { id: "warmind", label: "Warmind" }, detect: has(/warmind|^\s*─{5,}/im), guided },
  { format: { id: "warorgan", label: "WarOrgan" }, detect: has(/warorgan|point limit\)/i), guided },
  { format: { id: "ironbuilt", label: "Ironbuilt" }, detect: has(/ironbuilt|^\+={5,}/im), guided },
  { format: { id: "40kapp", label: "40k.app" }, detect: has(/40k\.app|^\d+\/\d+ pts$/im), guided },
  { format: { id: "text", label: "Free-form list" }, detect: () => true, guided },
];

export type ReadList = { list: ArmyList; format: ListFormat; bundle: FactionBundle };

/**
 * Reads a list in whatever format it came in. Fixed-grammar formats are read
 * first and name their faction; the rest name a faction somewhere in their
 * header, whose bundle then reads them.
 */
export async function readList(
  input: string,
  loadBundle: (faction: string) => Promise<FactionBundle>,
): Promise<ReadList> {
  const text = cleanText(input).trim();
  if (!text) throw new Error("The list is empty.");
  const parser = LIST_PARSERS.find((p) => p.detect(text)) ?? LIST_PARSERS[LIST_PARSERS.length - 1];
  if (!parser) throw new Error("No list format matched.");

  if (parser.parse) {
    const list = parser.parse(text);
    if (!list.faction)
      throw new Error(list.warnings[0] ?? "Couldn't tell which faction this list is for.");
    const faction = findFaction(list.faction)?.name ?? list.faction;
    return { list: { ...list, faction }, format: parser.format, bundle: await loadBundle(faction) };
  }

  const faction = listFaction(text);
  if (!faction) {
    throw new Error(
      "Couldn't tell which faction this list is for. Is the faction named near the top?",
    );
  }
  const bundle = await loadBundle(faction);
  const list = parser.guided ? parser.guided(text, bundle) : parseGuided(text, bundle);
  return { list, format: parser.format, bundle };
}

/** A free-form list's faction: a WTC header's, else the first faction named near the top, else anywhere. */
export function listFaction(text: string): string | undefined {
  const lines = text.split("\n");
  const wtc = parseWtcHeader(lines)?.faction;
  const fromHeader = wtc ? (findFaction(wtc) ?? detectFaction(wtc)) : undefined;
  return (fromHeader ?? detectFaction(lines.slice(0, 12).join("\n")) ?? detectFaction(text))?.name;
}
