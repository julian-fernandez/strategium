import type { Catalogues } from "./bsdata/catalogues";
import { buildDatasheet } from "./bsdata/datasheet";
import { crossCheck } from "./crosscheck";
import type { ArmyList } from "./list/parse";
import { stripTags } from "./markup";
import { selectStratagems, stratagemsFor } from "./stratagems";
import type { Army, AttachedGroup, BattleSize, DataVersions } from "./types";
import { comparable, findDatasheet, findFaction, type Wahapedia } from "./wahapedia";

/** Battle sizes the app is built for. Anything else still loads, with a warning. */
const SUPPORTED_SIZES = [
  { name: "Incursion", points: 1000 },
  { name: "Strike Force", points: 2000 },
];

export function buildArmy(
  list: ArmyList,
  catalogues: Catalogues,
  data: Wahapedia,
  versions: DataVersions,
): Army {
  const warnings = [...list.warnings];
  const faction = findFaction(data, list.faction);
  if (!faction) warnings.push(`Wahapedia has no faction named "${list.faction}".`);

  const detachments = matchDetachments(data, list.detachmentText, faction?.id);
  if (detachments.unmatched) {
    warnings.push(
      `Couldn't match "${detachments.unmatched}" to a detachment; its stratagems are missing.`,
    );
  }

  const units = list.units.map((unit, index) => {
    const sheet = buildDatasheet(catalogues, unit, `u${index + 1}`);
    const match = findDatasheet(data, unit.name, faction?.id);
    if (match) {
      sheet.wahapediaId = match.id;
      sheet.legend = stripTags(match.legend) || undefined;
    } else {
      sheet.warnings.push(
        `Wahapedia has no datasheet named "${unit.name}", so it has no stratagems.`,
      );
    }
    return sheet;
  });

  for (const unit of units) for (const warning of unit.warnings) warnings.push(warning);

  const stratagems = selectStratagems(
    data,
    detachments.matched.map((d) => d.id),
    units,
  );

  const groups: AttachedGroup[] = [];
  for (const unit of units) {
    if (!unit.attachment) continue;
    let group = groups.find((g) => g.id === unit.attachment?.group);
    if (!group) {
      group = { id: unit.attachment.group, bodyguardId: "", characterIds: [], stratagemIds: [] };
      groups.push(group);
    }
    if (unit.attachment.role === "bodyguard") group.bodyguardId = unit.id;
    else group.characterIds.push(unit.id);
  }
  for (const group of groups) {
    const members = units.filter(
      (unit) => unit.id === group.bodyguardId || group.characterIds.includes(unit.id),
    );
    group.stratagemIds = stratagemsFor(data, stratagems, members);
    if (!group.bodyguardId) warnings.push(`Attached unit ${group.id} has no bodyguard unit.`);
  }

  return {
    note: list.note,
    faction: list.faction,
    detachments: detachments.matched.map((d) => d.name),
    disposition: list.disposition,
    battleSize: list.battleSize ? battleSize(list.battleSize, warnings) : undefined,
    units,
    groups,
    stratagems,
    crossCheck: crossCheck(data, units),
    warnings,
    data: versions,
  };
}

function battleSize(size: { name: string; points: number }, warnings: string[]): BattleSize {
  const supported = SUPPORTED_SIZES.some((s) => s.points === size.points);
  if (!supported) {
    warnings.push(
      `${size.name} (${size.points} points) isn't a size the cards are tuned for (1,000 or 2,000).`,
    );
  }
  return { ...size, supported };
}

/**
 * Finds the detachments named in the header line. Names can contain "and", so
 * the faction's detachment names are matched longest first instead of splitting.
 */
export function matchDetachments(
  data: Wahapedia,
  text: string,
  factionId: string | undefined,
): { matched: { id: string; name: string }[]; unmatched?: string } {
  const playable = data.detachments.filter((d) => d.type !== "Boarding Actions");
  const own = playable.filter((d) => d.factionId === factionId);
  const pools = [own, playable];

  let rest = ` ${comparable(text)} `;
  const matched: { id: string; name: string }[] = [];
  for (const pool of pools) {
    const byLength = [...pool].sort((a, b) => b.name.length - a.name.length);
    for (const detachment of byLength) {
      const name = ` ${comparable(detachment.name)} `;
      if (!rest.includes(name)) continue;
      if (matched.some((m) => m.name === detachment.name)) continue;
      matched.push({ id: detachment.id, name: detachment.name });
      rest = rest.replace(name, " ");
    }
  }

  const leftover = rest.replace(/\b(and)\b|,/g, " ").trim();
  return { matched: sortByText(matched, text), unmatched: leftover || undefined };
}

function sortByText<T extends { name: string }>(items: T[], text: string): T[] {
  const lower = comparable(text);
  return [...items].sort(
    (a, b) => lower.indexOf(comparable(a.name)) - lower.indexOf(comparable(b.name)),
  );
}
