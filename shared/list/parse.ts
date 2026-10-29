import type { AttachmentRole } from "../types";

/**
 * Parses the text export New Recruit and the GW app produce, for example:
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
 *   ...
 */

export type ListItem = { count: number; name: string };

/** A `• 9x Insidiant` line and the `◦` lines under it. Counts are totals for the group. */
export type ListModelGroup = { count: number; name: string; items: ListItem[] };

export type ListUnit = {
  name: string;
  points: number;
  section: string;
  attachment?: { role: AttachmentRole; group: number };
  isWarlord: boolean;
  enhancement?: string;
  groups: ListModelGroup[];
  /** `• Nx Item` lines with nothing under them, as single-model units list their wargear. */
  items: ListItem[];
};

export type ArmyList = {
  note?: string;
  faction: string;
  /** The detachment line without its points, e.g. `Champions of Faith and Sanctified Orators`. */
  detachmentText: string;
  detachmentPoints?: number;
  disposition?: string;
  battleSize?: { name: string; points: number };
  units: ListUnit[];
  exporter?: string;
  warnings: string[];
};

const UNIT_LINE = /^(.+?) \(([\d,]+) (?:Points|pts)\)$/i;
const DETACHMENT_LINE = /^(.+?) \((\d+) Detachment Points?\)$/i;
const COUNT_LINE = /^(\d+)x (.+)$/;
const GROUP_LINE = /^Attached unit (\d+)$/i;
const TOP_BULLET = "•";
const SUB_BULLET = "◦";

export function parseArmyList(text: string): ArmyList {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  const firstSection = lines.findIndex(isSectionHeader);
  const headerLines = (firstSection === -1 ? lines : lines.slice(0, firstSection)).filter(Boolean);
  const list: ArmyList = { ...parseHeader(headerLines), units: [], warnings: [] };
  if (!list.faction) list.warnings.push("Couldn't find the faction line at the top of the list.");

  let section = "";
  let group: number | undefined;
  let unit: ListUnit | undefined;
  let lastTop: ListModelGroup | undefined;

  for (const line of firstSection === -1 ? [] : lines.slice(firstSection)) {
    if (!line) continue;

    if (line.startsWith("Exported with")) {
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

    if (line.startsWith(TOP_BULLET)) {
      if (!unit) {
        list.warnings.push(`Couldn't place "${line}".`);
        continue;
      }
      lastTop = undefined;
      parseTopBullet(line.slice(TOP_BULLET.length).trim(), unit, group, (entry) => {
        lastTop = entry;
      });
      continue;
    }

    const unitMatch = UNIT_LINE.exec(line);
    if (unitMatch) {
      unit = {
        name: unitMatch[1] ?? line,
        points: toNumber(unitMatch[2]),
        section,
        isWarlord: false,
        groups: [],
        items: [],
      };
      lastTop = undefined;
      list.units.push(unit);
      continue;
    }

    list.warnings.push(`Ignored a line I didn't recognise: "${line}".`);
  }

  return list;
}

function parseHeader(lines: string[]): Omit<ArmyList, "units" | "warnings"> {
  const battleIndex = lines.findLastIndex((line) => UNIT_LINE.test(line));
  const detachmentIndex = lines.findIndex((line) => DETACHMENT_LINE.test(line));

  const battle = battleIndex === -1 ? undefined : UNIT_LINE.exec(lines[battleIndex] ?? "");
  const detachment =
    detachmentIndex === -1 ? undefined : DETACHMENT_LINE.exec(lines[detachmentIndex] ?? "");

  // Without a detachment-points line, assume: faction, detachment, disposition, battle size.
  const anchor = detachmentIndex === -1 ? Math.max(battleIndex - 2, 1) : detachmentIndex;
  const factionIndex = anchor - 1;

  return {
    note: lines.slice(0, Math.max(factionIndex, 0)).join("\n") || undefined,
    faction: lines[factionIndex] ?? "",
    detachmentText: detachment ? (detachment[1] ?? "") : (lines[anchor] ?? ""),
    detachmentPoints: detachment ? toNumber(detachment[2]) : undefined,
    disposition:
      lines.slice(anchor + 1, battleIndex === -1 ? undefined : battleIndex).join(" ") || undefined,
    battleSize: battle ? { name: battle[1] ?? "", points: toNumber(battle[2]) } : undefined,
  };
}

function parseTopBullet(
  content: string,
  unit: ListUnit,
  group: number | undefined,
  setLastTop: (entry: ListModelGroup) => void,
): void {
  if (/^Attached as:/i.test(content)) {
    const role = attachmentRole(content);
    if (role && group !== undefined) unit.attachment = { role, group };
    return;
  }
  if (/^Warlord$/i.test(content)) {
    unit.isWarlord = true;
    return;
  }
  const enhancement = /^Enhancements?: (.+)$/i.exec(content);
  if (enhancement) {
    unit.enhancement = enhancement[1];
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

function attachmentRole(content: string): AttachmentRole | undefined {
  if (/leader/i.test(content)) return "leader";
  if (/support/i.test(content)) return "support";
  if (/bodyguard/i.test(content)) return "bodyguard";
  return undefined;
}

function parseCount(content: string): ListItem | undefined {
  const match = COUNT_LINE.exec(content);
  if (!match) return undefined;
  return { count: Number(match[1]), name: (match[2] ?? "").trim() };
}

function isSectionHeader(line: string): boolean {
  return /^[A-Z][A-Z &'-]+$/.test(line) && line.length > 3;
}

function toNumber(value: string | undefined): number {
  return Number((value ?? "").replace(/,/g, ""));
}
