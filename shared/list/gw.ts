import { detectFaction, findFaction } from "../factions";
import type { AttachmentRole } from "../types";
import {
  battleSize,
  cleanText,
  DISPOSITIONS,
  POINTS_WORD,
  parseWtcHeader,
  toPoints,
  type WtcHeader,
} from "./text";
import type { ArmyList, ListItem, ListModelGroup, ListUnit } from "./types";

/**
 * The official app's text export, which most lists are, in both of its
 * dialects, and the builders that copy it (New Recruit's "GW" export,
 * BattleBase):
 *
 *   Adepta Sororitas
 *   Champions of Faith and Sanctified Orators (3 Detachment Points)
 *   Disruption
 *   Strike Force (2,000 Points)
 *
 *   ATTACHED UNITS
 *   Attached unit 1
 *   Ministorum Priest (50 Points)
 *   • Attached as: Leader (Character)
 *   • 1x Zealot's vindictor
 *
 * The nested dialect puts a model group's wargear under it with `◦`; the flat
 * one bullets only the first line and loses the rest of the structure when
 * pasted, so its model and wargear lines are all kept at the unit's level and
 * told apart later against the data. Labels are read in every language the
 * app exports; a "+++" WTC header pasted on top fills in what the body lacks.
 */

const UNIT_LINE = new RegExp(`^(.+?)\\s*\\(\\s*([\\d][\\d.,\\s]*)\\s*${POINTS_WORD}\\s*\\)$`, "iu");
const DETACHMENT_LINE =
  /^(.*?)\s*\(\s*(\d+)\s*(?:\/\s*\d+\s*)?(?:detachment points?|points? de détachement|kontingentspunkte|puntos de destacamento|punti(?: di)? distaccamento|デタッチメントポイント|디태치먼트 포인트)\s*\)\s*$/iu;
const GROUP_LINE =
  /^(?:attached unit|angeschlossene einheit|unidad adjunta|unité attachée|unità aggregata|合流ユニット|합류 유닛)\s*(\d+)$/iu;
const SECTION_NAMES =
  /^(?:attached units|angeschlossene einheiten|unidades adjuntas|unités attachées|unità aggregate|合流ユニット|합류 유닛|キャラクター|その他のデータシート|バトルライン|専用輸送|同盟ユニット|캐릭터|기타 데이터시트|전속 수송|전선|동맹 유닛)$/iu;
const ATTACHED_AS =
  /^(?:attached as|angeschlossen als|adjunta como|attachée? en tant que|aggregata come|합류 방식)\s*:\s*(.*)$|^(.+)として合流/iu;
const WARLORD =
  /^(?:warlord|kriegsherr|señor de la guerra|seigneur de guerre|generale|ウォーロード|총사령관)$/iu;
const ENHANCEMENT =
  /^(?:enhancements?|verbesserung(?:en)?|mejoras?|optimisations?|potenziament[io]|強化|강화)\s*:\s*(.+)$/iu;
/** New Recruit's older GW export writes an enhancement as "• Name (+30 pts)". */
const COSTED_UPGRADE = /^(.+?)\s*\(\+\s*\d+\s*(?:pts?|points?)\)$/iu;
const FOOTER =
  /^(?:exported with|created with|exportiert mit|exportada con|exporté avec|esportato con|書き出し情報|내보낸 앱의 버전)/iu;
/** The app's own complaints ("Invalid wargear selected for …"), which carry nothing to place. */
const APP_NOTICE = /^invalid wargear/i;
const BULLET = "•";
const SUB_BULLET = "◦";

const ROLES: [AttachmentRole, RegExp][] = [
  ["leader", /leader|anführer|líder|meneur|指揮官|리더/iu],
  ["support", /support|unterstützung|apoyo|soutien|supporto|サポート|支援|서포트/iu],
  ["bodyguard", /bodyguard|leibwache|escolta|gardes? du corps|guardi[ae] del corpo|護衛|경호원/iu],
];

export function parseGwText(text: string): ArmyList {
  const lines = cleanText(text)
    .split("\n")
    .map((line) => line.trim().replace(/^[*-]\s+(?=\S)/, `${BULLET} `));
  const wtc = parseWtcHeader(lines);
  const body = lines.filter((line) => !/^[+&]/.test(line));

  const start = body.findIndex(
    (line, index) =>
      isSectionHeader(line) ||
      GROUP_LINE.test(line) ||
      (UNIT_LINE.test(line) && isBullet(nextLine(body, index))),
  );
  const header = (start === -1 ? body : body.slice(0, start)).filter(Boolean);
  const list: ArmyList = { ...parseHeader(header, wtc), units: [], warnings: [] };
  if (!list.faction) list.warnings.push("Couldn't find the faction line at the top of the list.");

  let section = "";
  let group: number | undefined;
  let unit: ListUnit | undefined;
  let lastTop: ListModelGroup | undefined;

  for (const line of start === -1 ? [] : body.slice(start)) {
    if (!line || APP_NOTICE.test(line.replace(/^[•◦]\s*/, ""))) continue;
    // Players' own labels between units ("Agents:", "Yesod:").
    if (/^[^•◦\d()]{2,40}:$/u.test(line)) continue;
    if (FOOTER.test(line)) {
      list.exporter = line;
      continue;
    }
    if (isSectionHeader(line)) {
      section = line;
      group = undefined;
      unit = undefined;
      continue;
    }
    const groupMatch = GROUP_LINE.exec(line);
    if (groupMatch) {
      group = Number(groupMatch[1]);
      unit = undefined;
      continue;
    }

    if (line.startsWith(SUB_BULLET)) {
      const item = parseCount(line.slice(SUB_BULLET.length).trim());
      if (unit && lastTop && item) {
        lastTop.items.push(item);
        // A top-level line with lines under it is a model group, not an item.
        const index = unit.items.indexOf(lastTop);
        if (index !== -1) {
          unit.items.splice(index, 1);
          unit.groups.push(lastTop);
        }
      } else {
        list.warnings.push(`Couldn't place "${line}".`);
      }
      continue;
    }

    if (line.startsWith(BULLET)) {
      if (!unit) {
        list.warnings.push(`Couldn't place "${line}".`);
        continue;
      }
      lastTop = undefined;
      parseTopBullet(line.slice(BULLET.length).trim(), unit, group, (entry) => {
        lastTop = entry;
      });
      continue;
    }

    const unitMatch = UNIT_LINE.exec(line);
    if (unitMatch) {
      unit = {
        name: unitMatch[1] ?? line,
        points: toPoints(unitMatch[2]),
        section,
        isWarlord: false,
        groups: [],
        items: [],
      };
      lastTop = undefined;
      list.units.push(unit);
      continue;
    }

    // The flat dialect bullets only a group's first wargear line; the rest follow bare.
    const item = unit ? parseCount(line) : undefined;
    if (unit && item) {
      unit.items.push(item);
      continue;
    }

    list.warnings.push(`Ignored a line I didn't recognise: "${line}".`);
  }

  if (wtc) applyWtcHeader(list, wtc);
  return list;
}

/**
 * The header, found by shape rather than position: titles, notes and chapter
 * lines come and go, and a pasted WTC block may stand in for it entirely.
 */
function parseHeader(
  lines: string[],
  wtc: WtcHeader | undefined,
): Omit<ArmyList, "units" | "warnings"> {
  const detachmentIndexes = lines.flatMap((line, index) =>
    DETACHMENT_LINE.test(line) ? [index] : [],
  );
  const firstDetachment = detachmentIndexes[0] ?? -1;
  const lastDetachment = detachmentIndexes.at(-1) ?? -1;

  // Detachments: one line, or one per line, or one name broken over two lines.
  const detachmentParts: string[] = [];
  let detachmentPoints = 0;
  for (const index of detachmentIndexes) {
    const match = DETACHMENT_LINE.exec(lines[index] ?? "");
    let name = match?.[1] ?? "";
    const previous = lines[index - 1] ?? "";
    if (index === firstDetachment && previous.endsWith(",")) name = `${previous} ${name}`;
    detachmentParts.push(name);
    detachmentPoints += Number(match?.[2] ?? 0);
  }
  const detachmentStart =
    firstDetachment > 0 && (lines[firstDetachment - 1] ?? "").endsWith(",")
      ? firstDetachment - 1
      : firstDetachment;

  // The battle size: the last points line after the detachments.
  const sizeIndex = lines.findLastIndex(
    (line, index) => index > lastDetachment && UNIT_LINE.test(line) && !DETACHMENT_LINE.test(line),
  );
  const sizeMatch = sizeIndex === -1 ? undefined : UNIT_LINE.exec(lines[sizeIndex] ?? "");

  // The faction: the line above the detachments, else any line naming one.
  const above = detachmentStart > 0 ? (lines[detachmentStart - 1] ?? "") : "";
  const factionLine = findFaction(above) ? above : undefined;
  const faction =
    (factionLine ? findFaction(factionLine)?.name : undefined) ??
    (wtc?.faction ? (findFaction(wtc.faction) ?? detectFaction(wtc.faction))?.name : undefined) ??
    detectFaction(lines.slice(0, Math.max(detachmentStart, 0) || undefined).join("\n"))?.name ??
    wtc?.faction ??
    "";
  const factionIndex = factionLine ? detachmentStart - 1 : -1;
  // "Space Marines" above a chapter line belongs to the faction, not the note.
  const noteEnd =
    factionIndex > 0 && findFaction(lines[factionIndex - 1] ?? "")
      ? factionIndex - 1
      : factionIndex;

  const between = lines
    .slice(lastDetachment + 1, sizeIndex === -1 ? undefined : sizeIndex)
    .map((line) => line.replace(/^force disposition\s*:\s*/i, ""))
    .filter((line) => line && !UNIT_LINE.test(line));
  const disposition =
    between.join(" ") ||
    lines.map((line) => /^force disposition\s*:\s*(.+)$/i.exec(line)?.[1]).find(Boolean) ||
    wtc?.disposition ||
    DISPOSITIONS.find((d) => lines.some((line) => line.toLowerCase() === d.toLowerCase()));

  return {
    note: noteEnd > 0 ? lines.slice(0, noteEnd).join("\n") : undefined,
    faction,
    detachmentText: detachmentParts.join(" and ") || wtc?.detachments || "",
    detachmentPoints: detachmentIndexes.length ? detachmentPoints : undefined,
    disposition: disposition || undefined,
    battleSize: sizeMatch
      ? battleSize(toPoints(sizeMatch[2]), sizeMatch[1])
      : (wtc?.battleSize ?? (wtc?.totalPoints ? battleSize(wtc.totalPoints) : undefined)),
  };
}

/** What a WTC header knows that a GW body doesn't: the warlord and enhancements, by unit. */
function applyWtcHeader(list: ArmyList, wtc: WtcHeader): void {
  const byName = (name: string) => list.units.find((unit) => sameUnit(unit.name, name));
  if (wtc.warlord && !list.units.some((unit) => unit.isWarlord)) {
    const warlord = byName(wtc.warlord);
    if (warlord) warlord.isWarlord = true;
  }
  for (const enhancement of wtc.enhancements) {
    const unit = list.units.find((u) => sameUnit(u.name, enhancement.on) && !u.enhancement);
    if (unit) unit.enhancement = enhancement.name;
  }
}

function sameUnit(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function parseTopBullet(
  content: string,
  unit: ListUnit,
  group: number | undefined,
  setLastTop: (entry: ListModelGroup) => void,
): void {
  const attached = ATTACHED_AS.exec(content);
  if (attached) {
    const words = attached[1] ?? content;
    const role = ROLES.find(([, pattern]) => pattern.test(words))?.[0];
    if (role && group !== undefined) unit.attachment = { role, group };
    return;
  }
  if (WARLORD.test(content)) {
    unit.isWarlord = true;
    return;
  }
  const enhancement = ENHANCEMENT.exec(content) ?? COSTED_UPGRADE.exec(content);
  if (enhancement) {
    unit.enhancement = enhancement[1]?.trim();
    return;
  }
  const item = parseCount(content);
  if (item) {
    // Treated as an item until a `◦` line shows it is a model group.
    const entry: ListModelGroup = { ...item, items: [] };
    unit.items.push(entry);
    setLastTop(entry);
  }
}

/** "9x Bolt pistol", "1 Fire Axe" (Spanish), "블레이드가드 베테랑 2x개" (Korean). */
function parseCount(content: string): ListItem | undefined {
  const leading = /^(\d+)\s*x?\s+(.+)$/iu.exec(content) ?? /^(\d+)x(\S.*)$/iu.exec(content);
  if (leading) return { count: Number(leading[1]), name: (leading[2] ?? "").trim() };
  const trailing = /^(.+?)\s+(\d+)x개$/u.exec(content);
  if (trailing) return { count: Number(trailing[2]), name: (trailing[1] ?? "").trim() };
  return undefined;
}

/** A section heading: in capitals ("OTHER DATASHEETS", "UNITÉS ATTACHÉES") or one of the known ones. */
function isSectionHeader(line: string): boolean {
  if (SECTION_NAMES.test(line)) return true;
  if (/[()•◦:\d]/.test(line) || line.length < 4) return false;
  return line === line.toUpperCase() && line !== line.toLowerCase();
}

function isBullet(line: string | undefined): boolean {
  return line !== undefined && (line.startsWith(BULLET) || line.startsWith(SUB_BULLET));
}

function nextLine(lines: string[], index: number): string | undefined {
  return lines.slice(index + 1).find(Boolean);
}
