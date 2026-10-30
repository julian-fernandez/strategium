import { normalizeName } from "../bsdata/catalogues";
import type { FactionBundle, UnitData } from "../bundle";
import { findFaction } from "../factions";
import { findUnit } from "../resolve/datasheet";
import { looseName, matchEnhancement, matchItem, matchModel } from "../resolve/match";
import type { AttachmentRole } from "../types";
import { comparable } from "../wahapedia";
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
 * Every other text format, read against the faction's own vocabulary rather
 * than a fixed grammar: New Recruit's WTC, WTC-Compact and NR exports,
 * ListForge, Warmind, WarOrgan, Ironbuilt, 40k.app, and hand-written lists.
 *
 * A unit line is one that names a unit the faction has and carries points
 * ("Grey Hunters ×10 — 180 pts", "Char1: 1x Overlord (110 pts): …",
 * "Azrael [140 pts]: …"). The lines after it, and anything after a colon,
 * are read as wargear clauses ("4 with Choppa, Slugga", "5x Bolt Pistol +
 * Ceramite Fists / 4x Heavy Bolt Rifle", "Fusion blaster x6") and matched to
 * the unit's models and options. A unit that names no wargear at all gets
 * BSData's default loadout.
 */
export type GuidedOptions = {
  /** ListForge's short formats count duplicate units up front: "2x10 Jakhals" is two units of ten. */
  duplicates?: boolean;
};

type Draft = {
  unit: ListUnit;
  data: UnitData;
  /** The model count the unit line gives ("×10", "(6 models)", "10 Khorne Berzerkers"). */
  size?: number;
  /** Who this unit is attached to or leads, by name as the list wrote it. */
  links: string[];
  /** Copies of this unit the line stands for (ListForge's "2x"). */
  copies: number;
  attachedSection: boolean;
};

const POINTS = new RegExp(`(?<![+\\d])(\\d[\\d.,]*)\\s*${POINTS_WORD}\\b`, "iu");
const COSTED = new RegExp(`[([]\\s*\\+\\s*\\d+\\s*(?:${POINTS_WORD})?\\s*[)\\]]`, "giu");
const NOT_A_UNIT_LINE = /^[•◦·*-]/u;
const LINK =
  /^(?:leading|leads|supporting|supports|led by|supported by|leader|attached to)\b\s*:?\s*(.*)$/iu;
const ENHANCEMENT_LABEL = /^(?:enhancements?|e|army enhancements?.*?)\s*:\s*(.+)$/iu;
const LABELS = /^(?:weapons|wargear|upgrades?|options|loadout)\s*:\s*/iu;
const FOOTER = /^(?:created with|built with|exported (?:with|from)|https?:\/\/|total:)/iu;

export function parseGuided(
  text: string,
  bundle: FactionBundle,
  options: GuidedOptions = {},
): ArmyList {
  const lines = cleanText(text)
    .split("\n")
    .map((line) => line.trim());
  const wtc = parseWtcHeader(lines);
  const list: ArmyList = { faction: bundle.faction, detachmentText: "", units: [], warnings: [] };
  const drafts: Draft[] = [];
  const unmatched = new Set<string>();
  let current: Draft | undefined;
  let attachedSection = false;
  let pendingGroup: string[] = [];
  let firstUnitLine = -1;

  lines.forEach((raw, index) => {
    if (!raw || /^[+&]/.test(raw)) return;
    if (FOOTER.test(raw)) {
      if (/^(?:created|built|exported)/i.test(raw)) list.exporter = raw;
      return;
    }
    const line = raw.replace(/^[└↳|]+\s*/u, "").replace(/^-{2,}\s*/, "");
    // Rules drawn with box characters, and nothing else.
    if (/^[─━═=_~*·.\s-]+$/u.test(line)) return;

    // A heading: a section starts; "Attached Unit(s)" sections pair leaders with the unit after.
    if (isHeading(line)) {
      attachedSection = /attached|aggregat|attach/i.test(line);
      current = undefined;
      return;
    }

    // Warmind nests a bodyguard under its leader: "└ Leads: Terminator Squad ×10 — 390 pts".
    const leads = LINK.exec(line);
    const candidate = leads?.[1] && POINTS.test(line) ? leads[1] : line;
    const unitLine = NOT_A_UNIT_LINE.test(candidate)
      ? undefined
      : readUnitLine(candidate, bundle, options);
    if (!unitLine && !NOT_A_UNIT_LINE.test(line) && POINTS.test(line.replace(COSTED, ""))) {
      // Points but no unit: a summary ("2000 pts · 16 units"), a sub-faction heading
      // ("Ultramarines [1580 pts]"), or a unit this faction's data doesn't have.
      current = undefined;
      const name = unitLikeName(candidate);
      if (firstUnitLine !== -1 && name) {
        list.warnings.push(`${bundle.faction} has no unit named "${name}" in BSData.`);
      }
      return;
    }
    if (unitLine) {
      if (firstUnitLine === -1) firstUnitLine = index;
      // "Chaplain Grimaldus + Assault Intercessor Squad (300 pts)" heading its own two units.
      if (
        unitLine.length > 1 &&
        unitLine.every((u) => !u.gear) &&
        looksLikeGroupHeader(lines, index, unitLine, bundle)
      ) {
        pendingGroup = unitLine.map((u) => u.data.name);
        return;
      }
      const linkedTo = candidate !== line ? lastBodyguardOwner(drafts) : undefined;
      const made: Draft[] = [];
      for (const part of unitLine) {
        const draft: Draft = {
          unit: {
            name: part.data.name,
            points: part.points,
            section: "",
            isWarlord: part.warlord,
            groups: [],
            items: [],
          },
          data: part.data,
          size: part.size,
          links: [],
          copies: part.copies,
          attachedSection: attachedSection || pendingGroup.includes(part.data.name),
        };
        if (pendingGroup[0] === part.data.name) pendingGroup.shift();
        if (part.gear) readGear(part.gear, draft, bundle, unmatched);
        if (part.enhancement) draft.unit.enhancement = part.enhancement;
        made.push(draft);
        drafts.push(draft);
      }
      // A combined line is one attached group: characters first, bodyguard last.
      if (made.length > 1) {
        const bodyguard = made.at(-1);
        for (const draft of made.slice(0, -1)) if (bodyguard) draft.links.push(bodyguard.data.name);
      }
      // Warmind's "└ Leads: X ×3 — 85 pts" nests the bodyguard under its leader.
      if (linkedTo && made[0]) linkedTo.links.push(made[0].data.name);
      current = made.at(-1);
      return;
    }

    if (!current) return;
    const content = line.replace(/^(?:[•◦·*-]\s*)+/u, "");
    // "• Attached as: Leader (Character)": the "Attached Unit" section already pairs them.
    if (/^attached as\s*:/i.test(content)) return;
    const link = LINK.exec(content);
    if (link) {
      const target = (link[1] ?? "").replace(/\s*[[(]\d+[\])]\s*$/, "").trim();
      if (target) current.links.push(target);
      else current.links.push(""); // Ironbuilt's bare "↳ Attached to:" means the next unit.
      return;
    }
    if (/^warlord$/i.test(content)) {
      current.unit.isWarlord = true;
      return;
    }
    const enhancement = ENHANCEMENT_LABEL.exec(content);
    if (enhancement) {
      current.unit.enhancement = stripCost(enhancement[1] ?? "");
      return;
    }
    readGear(content, current, bundle, unmatched);
  });

  const header = lines.slice(0, firstUnitLine === -1 ? lines.length : firstUnitLine).join("\n");
  readHeader(list, header, wtc, bundle);
  finishUnits(list, drafts, bundle, wtc);
  for (const name of unmatched) {
    list.warnings.push(`Couldn't match "${name}" to anything in BSData.`);
  }
  return list;
}

type UnitLinePart = {
  data: UnitData;
  points: number;
  size?: number;
  copies: number;
  warlord: boolean;
  enhancement?: string;
  gear?: string;
};

/** The unit (or units, joined by " + ") a line names, if it's a unit line at all. */
function readUnitLine(
  line: string,
  bundle: FactionBundle,
  options: GuidedOptions,
): UnitLinePart[] | undefined {
  const points = POINTS.exec(line.replace(COSTED, ""));
  if (!points) return undefined;
  const total = toPoints(points[1]);

  // Everything but the points and markers, then split into units at " + ".
  const body = line
    .replace(COSTED, "")
    .replace(
      new RegExp(`[([]?\\s*(?:—|–|-)?\\s*\\d[\\d.,]*\\s*${POINTS_WORD}\\b[^)\\]:]*[)\\]]?`, "giu"),
      " ",
    )
    .replace(/\(\s*\d+\s*models?\s*\)/giu, " ")
    .replace(/\s+—\s*$/, "")
    .trim();
  const parts = body.split(/\s+\+\s+/);
  const found: UnitLinePart[] = [];
  for (const part of parts) {
    const read = readUnitPart(part, bundle, options);
    if (!read) {
      // A " + " that isn't between units belongs to the gear ("Bolt Pistol + Force Weapon").
      if (found.length) {
        const last = found[found.length - 1];
        if (last) last.gear = [last.gear, part].filter(Boolean).join(" + ");
        continue;
      }
      return undefined;
    }
    found.push({ ...read, points: 0 });
  }
  const last = found.at(-1);
  if (!last) return undefined;
  // A combined line's points are the group's; they go to the bodyguard, as does "(6 models)".
  last.points = total;
  const models = /\(\s*(\d+)\s*models?\s*\)/iu.exec(line)?.[1];
  if (models) last.size = Number(models);
  for (const part of found) {
    if (part.copies > 1) part.points = Math.round(part.points / part.copies);
  }
  return found;
}

function readUnitPart(
  raw: string,
  bundle: FactionBundle,
  options: GuidedOptions,
): Omit<UnitLinePart, "points"> | undefined {
  let text = raw
    .replace(/^(?:[a-z]{3,5}\d+|ligne \d+|personnages? \d+)\s*:\s*/iu, "")
    .replace(/^\[[^\]]+\]\s*/u, "")
    .trim();
  let gear: string | undefined;
  const colon = text.indexOf(":");
  if (colon !== -1) {
    gear = text.slice(colon + 1).trim() || undefined;
    text = text.slice(0, colon).trim();
  }
  let warlord = false;
  text = text
    .replace(/\[\s*warlord\s*\]|[-·•,]\s*warlord\b/giu, () => {
      warlord = true;
      return "";
    })
    .trim();

  let size: number | undefined;
  let copies = 1;
  const multi = /^(\d+)\s*x\s*(\d+)\s+(.+)$/iu.exec(text);
  const counted = /^(\d+)\s*x?\s+(.+)$/iu.exec(text);
  const trailing = /^(.+?)\s+x\s*(\d+)$/iu.exec(text);
  if (multi) {
    copies = Number(multi[1]);
    size = Number(multi[2]);
    text = multi[3] ?? text;
  } else if (counted) {
    const isTimes = /^\d+\s*x/iu.test(text);
    if (options.duplicates && isTimes) copies = Number(counted[1]);
    else size = Number(counted[1]);
    text = counted[2] ?? text;
  } else if (trailing) {
    size = Number(trailing[2]);
    text = trailing[1] ?? text;
  }

  const data = unitByName(bundle, text);
  if (data) return { data, size, copies, warlord, gear };

  // A loadout or enhancement after the name ("Telemon Heavy Dreadnought with Augury Uplink").
  const split = /^(.+?)\s+(?:with|w\/|-)\s+(.+)$/iu.exec(text);
  const head = split ? unitByName(bundle, split[1] ?? "") : undefined;
  if (split && head) {
    const extra = split[2] ?? "";
    const enhancement = matchEnhancement(bundle, head, extra) ? extra : undefined;
    return {
      data: head,
      size,
      copies,
      warlord,
      enhancement,
      gear: enhancement ? gear : [extra, gear].filter(Boolean).join(", "),
    };
  }
  return undefined;
}

/** A unit by name, also without a duplicate letter ("Meganobz A") or instance number ("[2]"). */
function unitByName(bundle: FactionBundle, name: string): UnitData | undefined {
  const clean = name.replace(/\s*\[\d+\]$/, "").trim();
  if (!clean) return undefined;
  return findUnit(bundle, clean) ?? findUnit(bundle, clean.replace(/\s+[A-Z]$/, ""));
}

/**
 * Wargear clauses: "Nx Model: gear", "N with A, B", "A + B / Nx C", "A x6",
 * "A, B and C". A clause's count applies to every name in it that has none of its own.
 */
function readGear(text: string, draft: Draft, bundle: FactionBundle, unmatched: Set<string>): void {
  let content = text.replace(LABELS, "").replace(COSTED, "").trim();
  if (!content) return;

  // "1x Nob: Rokkit Pistol, Smash Hammer" / "Ravenwing Champion [30 pts]: …"
  const modelLine = /^(?:(\d+)\s*x?\s+)?([^:,]+?)(?:\s*\[[^\]]*\])?\s*:\s*(.+)$/iu.exec(content);
  if (modelLine) {
    const count = Number(modelLine[1] ?? 1);
    const model = matchModel(draft.data, modelLine[2] ?? "");
    if (model) {
      const group = addGroup(draft, model.model.name, count);
      readClauses(modelLine[3] ?? "", draft, bundle, unmatched, group, count);
      return;
    }
  }
  // "1 Tyrant Guard with scything talons & rending claws"
  const withLine = /^(?:(\d+)\s*x?\s+)?(.+?)\s+(?:with|w\/)\s+(.+)$/iu.exec(content);
  // Only a lone model with its loadout, not a list that happens to contain "with".
  if (withLine && !/^\d+\s+with\b/i.test(content) && !(withLine[2] ?? "").includes(",")) {
    const count = Number(withLine[1] ?? 1);
    const model =
      draft.data.models[normalizeName(content.replace(/^\d+\s*x?\s+/i, ""))] === undefined
        ? matchModel(draft.data, withLine[2] ?? "")
        : undefined;
    if (model) {
      const group = addGroup(draft, model.model.name, count);
      readClauses(withLine[3] ?? "", draft, bundle, unmatched, group, count);
      return;
    }
  }
  content = content.replace(/\s*,?\s*\bwarlord\b\s*,?/iu, () => {
    draft.unit.isWarlord = true;
    return ",";
  });
  readClauses(content, draft, bundle, unmatched, undefined, undefined);
}

function readClauses(
  text: string,
  draft: Draft,
  bundle: FactionBundle,
  unmatched: Set<string>,
  group: ListModelGroup | undefined,
  groupCount: number | undefined,
): void {
  for (const clause of text.split(/\s+\/\s+|;\s*/)) {
    const lead = /^(\d+)\s*(?:x|with)\s+/iu.exec(clause);
    const clauseCount = lead ? Number(lead[1]) : undefined;
    const body = lead ? clause.slice(lead[0].length) : clause;
    for (const piece of body.split(/\s*,\s*|\s+\+\s+/)) {
      readMention(piece, clauseCount ?? groupCount, draft, bundle, unmatched, group);
    }
  }
}

/** One name with its count, as a model group, an option, an enhancement or "Warlord". */
function readMention(
  raw: string,
  fallbackCount: number | undefined,
  draft: Draft,
  bundle: FactionBundle,
  unmatched: Set<string>,
  group: ListModelGroup | undefined,
): void {
  let name = raw.replace(/[.;]$/, "").trim();
  if (!name || /^[[(]?\s*\d+\s*(?:pts|points?)?\s*[)\]]?$/i.test(name)) return;
  let count = fallbackCount ?? 1;
  const leading = /^(\d+)\s*x?\s+(.+)$/iu.exec(name);
  const trailing = /^(.+?)\s+x\s*(\d+)$/iu.exec(name);
  if (leading) {
    count = Number(leading[1]);
    name = leading[2] ?? name;
  } else if (trailing) {
    count = Number(trailing[2]);
    name = trailing[1] ?? name;
  }
  name = stripCost(name);
  if (/^warlord$/i.test(name)) {
    draft.unit.isWarlord = true;
    return;
  }

  const model = group ? undefined : matchModel(draft.data, name);
  const item = matchItem(
    [group ? draft.data.models[normalizeName(group.name)]?.items : undefined, draft.data.items],
    name,
    draft.data.aliases,
  );
  if (item && (item.exact || !model?.exact)) {
    const enhancement =
      item.item.abilities.length && !item.item.ranged.length && !item.item.melee.length
        ? matchEnhancement(bundle, draft.data, name)
        : undefined;
    if (enhancement && isEnhancementName(bundle, name)) {
      draft.unit.enhancement = name;
      return;
    }
    addItem(group ? group.items : draft.unit.items, item.item.name, count);
    return;
  }
  if (model) {
    addGroup(draft, model.model.name, count);
    return;
  }
  if (isEnhancementName(bundle, name)) {
    draft.unit.enhancement = name;
    return;
  }
  // "Cyclone Missile Launcher and Storm Bolter", "A, B and C": try the parts.
  const parts = name.split(/\s+(?:and|&)\s+/i);
  if (parts.length > 1) {
    const before = unmatched.size;
    for (const part of parts) readMention(part, count, draft, bundle, unmatched, group);
    if (unmatched.size === before) return;
  }
  unmatched.add(`${name} (${draft.unit.name})`);
}

function isEnhancementName(bundle: FactionBundle, name: string): boolean {
  const wanted = comparable(stripCost(name)).replace(/^the /, "");
  return bundle.detachments.some((d) =>
    d.enhancements.some((e) => comparable(e.name).replace(/^the /, "") === wanted),
  );
}

function addGroup(draft: Draft, name: string, count: number): ListModelGroup {
  // One line per model ("• 1 Tyrant Guard with …" six times) adds up to one group.
  const existing = draft.unit.groups.find((g) => g.name === name);
  if (existing) {
    existing.count += count;
    return existing;
  }
  const group: ListModelGroup = { count, name, items: [] };
  draft.unit.groups.push(group);
  return group;
}

function addItem(items: ListItem[], name: string, count: number): void {
  const existing = items.find((item) => item.name === name);
  if (existing) existing.count += count;
  else items.push({ count, name });
}

/** A name without its cost ("[+10 points]", "[15 pts]") or an "(Upgrade)"/"(Aura)" tag. */
function stripCost(name: string): string {
  return name
    .replace(COSTED, "")
    .replace(new RegExp(`\\s*[[(]\\s*\\d+\\s*${POINTS_WORD}\\s*[)\\]]`, "giu"), "")
    .replace(/\s*\((?:upgrade|aura)\)\s*$/i, "")
    .trim();
}

/** Section headings and role labels: "EPIC HEROES [455 pts]", "── INFANTRY ──", "Character:", "Monster". */
function isHeading(line: string): boolean {
  const bare = line
    .replace(/[─━=+-]{2,}/g, "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .replace(/:$/, "")
    .trim();
  if (!bare || bare.length > 40) return false;
  if (
    /^(?:attached units?|unattached characters|attached characters|other datasheets|allied units|dedicated transports?|epic heroe?s?|characters?|battleline|infantry|vehicles?|monsters?|mounted|beasts?|swarms?|fortifications?|transports?|leaders? & characters|infantry, swarms, beasts|configuration|allies)\b/i.test(
      bare,
    )
  ) {
    return (
      !POINTS.test(line) ||
      /^[A-Z ,&]+\s*\[/.test(line) ||
      /attached unit [a-z]\b/i.test(line) ||
      /^##/.test(line)
    );
  }
  return (
    /^##\s/.test(line) || (bare === bare.toUpperCase() && /[A-Z]{4}/.test(bare) && !/\d/.test(bare))
  );
}

/** Is a "+" line a heading over its units, which follow on their own lines? */
function looksLikeGroupHeader(
  lines: string[],
  index: number,
  parts: UnitLinePart[],
  bundle: FactionBundle,
): boolean {
  const next = lines.slice(index + 1).find((line) => line && !NOT_A_UNIT_LINE.test(line));
  if (!next) return false;
  const first = readUnitLine(next, bundle, {});
  return first?.[0]?.data.name === parts[0]?.data.name;
}

function lastBodyguardOwner(drafts: Draft[]): Draft | undefined {
  return drafts.at(-1);
}

/** Detachments, disposition and battle size, from wherever the format keeps them. */
function readHeader(
  list: ArmyList,
  header: string,
  wtc: WtcHeader | undefined,
  bundle: FactionBundle,
): void {
  const plain = ` ${comparable(header)
    .replace(/[,+/;:[\]()]/g, " ")
    .replace(/\s+/g, " ")} `;
  const detachments = bundle.detachments
    .filter((d) =>
      plain.includes(
        ` ${comparable(d.name)
          .replace(/[,+/;:]/g, " ")
          .replace(/\s+/g, " ")} `,
      ),
    )
    .map((d) => d.name);
  // A labelled line naming detachments the data doesn't know still goes through, so it's reported.
  const labelled = /^\W*detachments?(?:\(s\))?\b[^:\n]*:\s*(.+)$/imu
    .exec(header)?.[1]
    ?.replace(/\s*[[(][^\])]*[\])]/g, "")
    .trim();
  list.detachmentText = detachments.join(" and ") || wtc?.detachments || labelled || "";

  list.disposition =
    wtc?.disposition ?? DISPOSITIONS.find((d) => header.toLowerCase().includes(d.toLowerCase()));

  const sizeLine = /(strike force|incursion|onslaught)[^\n(]*\(\s*(\d[\d.,]*)/iu.exec(header);
  const limit = /(\d[\d.,]*)\s*\/\s*(\d[\d.,]*)\s*(?:pts|points)/iu.exec(header);
  const total =
    new RegExp(`(\\d[\\d.,]*)\\s*${POINTS_WORD}`, "iu").exec(header) ??
    /points\s*:\s*(\d[\d.,]*)/iu.exec(header);
  list.battleSize = sizeLine
    ? battleSize(toPoints(sizeLine[2]), sizeLine[1])
    : (wtc?.battleSize ??
      (limit
        ? battleSize(toPoints(limit[2]))
        : wtc?.totalPoints
          ? battleSize(wtc.totalPoints)
          : total
            ? battleSize(toPoints(total[1]))
            : undefined));
}

/**
 * Last pass over the units: copies, model groups for units the list gave only
 * a count for, default wargear where it named none, enhancements and the
 * warlord from a WTC header, and attached groups from every way of saying so.
 */
function finishUnits(
  list: ArmyList,
  drafts: Draft[],
  bundle: FactionBundle,
  wtc: WtcHeader | undefined,
): void {
  const units: Draft[] = [];
  for (const draft of drafts) {
    completeModels(draft);
    units.push(draft);
    for (let copy = 1; copy < draft.copies; copy++) {
      units.push({ ...draft, unit: structuredClone(draft.unit), links: [...draft.links] });
    }
  }

  for (const enhancement of wtc?.enhancements ?? []) {
    const target = units.find((d) => !d.unit.enhancement && sameName(d.unit.name, enhancement.on));
    if (target) target.unit.enhancement = enhancement.name;
  }
  if (wtc?.warlord && !units.some((d) => d.unit.isWarlord)) {
    const warlord = units.find((d) => sameName(d.unit.name, wtc.warlord ?? ""));
    if (warlord) warlord.unit.isWarlord = true;
  }

  // Attachments: each link pairs a character with a bodyguard; roles come from the data.
  let groupId = 0;
  const groupOf = new Map<Draft, number>();
  const pair = (a: Draft, b: Draft) => {
    const [character, bodyguard] =
      a.data.attachTo && !b.data.attachTo
        ? [a, b]
        : b.data.attachTo && !a.data.attachTo
          ? [b, a]
          : [a, b];
    let id = groupOf.get(bodyguard);
    if (id === undefined) {
      id = ++groupId;
      groupOf.set(bodyguard, id);
      bodyguard.unit.attachment = { role: "bodyguard", group: id };
    }
    const role: AttachmentRole =
      character.data.attachTo?.title === "Support" ? "support" : "leader";
    character.unit.attachment = { role, group: id };
  };
  units.forEach((draft, index) => {
    for (const link of draft.links) {
      const target = link
        ? findLinked(units, draft, link)
        : units.slice(index + 1).find((d) => !d.data.attachTo);
      if (target && !draft.unit.attachment) pair(draft, target);
    }
  });
  // WarOrgan-style "Attached Unit" sections: leaders, then the unit they join.
  let leaders: Draft[] = [];
  for (const draft of units) {
    if (!draft.attachedSection || draft.unit.attachment) {
      leaders = [];
      continue;
    }
    if (draft.data.attachTo) leaders.push(draft);
    else {
      for (const leader of leaders) pair(leader, draft);
      leaders = [];
    }
  }

  list.units = units.map((d) => d.unit);
  // Groups numbered in the order their units appear.
  void bundle;
}

/** The unit a link names: "Lokhust Destroyers[1]", "Meganobz A", or just the name. */
function findLinked(units: Draft[], from: Draft, link: string): Draft | undefined {
  const index = /\[(\d+)\]$/.exec(link)?.[1];
  const letter = /\s([A-Z])$/.exec(link)?.[1];
  const name = link
    .replace(/\s*\[\d+\]$/, "")
    .replace(/\s+[A-Z]$/, "")
    .replace(/\s*x\s*\d+.*$/i, "")
    .trim();
  const candidates = units.filter(
    (d) =>
      d !== from && (sameName(d.unit.name, name) || looseName(d.unit.name) === looseName(name)),
  );
  const nth = index ? Number(index) - 1 : letter ? letter.charCodeAt(0) - 65 : undefined;
  if (nth !== undefined && candidates[nth]) return candidates[nth];
  return candidates.find((d) => !d.unit.attachment) ?? candidates[0];
}

/** Model groups for a unit given only a count, and default wargear where none was named. */
function completeModels(draft: Draft): void {
  const { unit, data } = draft;
  const models = Object.entries(data.models);
  if (!unit.groups.length && models.length) {
    const size = draft.size ?? 0;
    if (models.length === 1 && models[0]) {
      unit.groups.push({ count: size || 1, name: models[0][1].name, items: [] });
    } else {
      // Each model's minimum, the rest made up by the default model (the trooper).
      let rest = size;
      for (const [key, model] of models) {
        if (key === data.defaultModel || model.min <= 0) continue;
        unit.groups.push({ count: model.min, name: model.name, items: [] });
        rest -= model.min;
      }
      const trooper = data.defaultModel ? data.models[data.defaultModel] : undefined;
      if (trooper)
        unit.groups.push({ count: Math.max(rest, trooper.min, 1), name: trooper.name, items: [] });
    }
  }
  const named = unit.items.length + unit.groups.reduce((sum, g) => sum + g.items.length, 0);
  if (named === 0) {
    for (const group of unit.groups) {
      const model = matchModel(data, group.name)?.model;
      for (const item of model?.defaults ?? []) {
        addItem(group.items, item.name, item.count * group.count);
      }
    }
  }
}

function sameName(a: string, b: string): boolean {
  return comparable(a) === comparable(b);
}

/**
 * The name on a points line that isn't a unit, if it reads like one: not a
 * summary ("2000 pts · 16 units"), a total, or a faction heading.
 */
function unitLikeName(line: string): string | undefined {
  if (/·|\/|\btotal\b|\bunits\b|\barmy\b/i.test(line)) return undefined;
  const name = line
    .replace(COSTED, "")
    .replace(/[([][^)\]]*[)\]]/g, "")
    .replace(new RegExp(`d[d.,]*s*${POINTS_WORD}`, "giu"), "")
    .replace(/^(?:[a-z]{3,5}\d+\s*:\s*)?\d+\s*x?\s+/iu, "")
    .replace(/[:—–-].*$/u, "")
    .trim();
  if (name.length < 3 || !/\p{L}{3}/u.test(name) || findFaction(name)) return undefined;
  return name;
}
