/**
 * Made-up lists that name everything one faction's data can show, for
 * `pnpm card-check --all`: every datasheet, every detachment, and each
 * enhancement on a character that can carry it. They're written in the
 * official app's text format, so they go through the same reader as a
 * pasted list, fifteen units to a list: about a real army, so each deck and
 * each stratagem's list of users stays the size a real list makes.
 */
import type { FactionBundle, UnitData } from "../shared/bundle";

/** What each unit carries: what it comes with, or every weapon it could take at once. */
export type Loadout = "default" | "everything";

export type SyntheticList = { label: string; text: string; units: number };

const PER_LIST = 15;

/**
 * `units` are the datasheets to show (the caller leaves out ones another
 * faction already showed); `seenEnhancements` does the same for enhancements,
 * which Space Marine chapters share.
 */
export function syntheticLists(
  bundle: FactionBundle,
  units: UnitData[],
  loadout: Loadout,
  seenEnhancements = new Set<string>(),
): SyntheticList[] {
  const entries = units.map((unit) => unitLines(unit, loadout));

  // Each enhancement once, on one of the faction's characters that isn't an Epic Hero (they can't take one).
  const bearer = Object.values(bundle.units).find(
    (unit) =>
      unit.wahapedia &&
      unit.keywords.some((k) => k.toLowerCase() === "character") &&
      !unit.keywords.some((k) => k.toLowerCase() === "epic hero"),
  );
  if (bearer && loadout === "default") {
    for (const detachment of bundle.detachments) {
      for (const { name } of detachment.enhancements) {
        if (seenEnhancements.has(name)) continue;
        seenEnhancements.add(name);
        entries.push(unitLines(bearer, "default", name));
      }
    }
  }

  const lists: SyntheticList[] = [];
  for (let start = 0; start < entries.length; start += PER_LIST) {
    const part = entries.slice(start, start + PER_LIST);
    const label = `${bundle.faction} ${loadout} ${start / PER_LIST + 1}/${Math.ceil(entries.length / PER_LIST)}`;
    lists.push({
      label,
      text: [...header(bundle, label), ...part.flat()].join("\n"),
      units: part.length,
    });
  }
  return lists;
}

function header(bundle: FactionBundle, label: string): string[] {
  const detachments = bundle.detachments.map((d) => d.name);
  return [
    `Strategium check: ${label}`,
    "",
    bundle.faction,
    `${detachments.join(" and ")} (${detachments.length} Detachment Points)`,
    "Take and Hold",
    "Strike Force (2,000 Points)",
    "",
    "OTHER DATASHEETS",
    "",
  ];
}

function unitLines(unit: UnitData, loadout: Loadout, enhancement?: string): string[] {
  const weapons =
    loadout === "everything"
      ? [
          ...new Set(
            Object.values(unit.items)
              .filter((item) => item.ranged.length || item.melee.length)
              .map((item) => item.name),
          ),
        ]
      : [];
  return [
    `${unit.name} (100 Points)`,
    ...weapons.map((name) => `• 1x ${name}`),
    ...(enhancement ? [`• Enhancements: ${enhancement}`] : []),
    "",
  ];
}
