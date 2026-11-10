import { POINTS_WORD } from "../../../shared/list/text";
import type { Army } from "../../../shared/types";

/** What the cover shows besides the faction, remembered for each list. */
export type CoverSettings = {
  listName: boolean;
  /** A name for a list that came without one. */
  name: string;
  detachments: boolean;
  points: boolean;
  /** Your own words, under the list's name. */
  message: string;
  /** An image you uploaded (kept in this browser) or linked. */
  image?: { kind: "upload" } | { kind: "link"; url: string };
};

export const DEFAULT_COVER: CoverSettings = {
  listName: true,
  name: "",
  detachments: true,
  points: true,
  message: "",
};

/** The longest message the cover takes: a few lines, at a size that still reads. */
export const COVER_MESSAGE_LIMIT = 280;
/** The longest name you can give a list. */
export const COVER_NAME_LIMIT = 80;

/** "Bear Force One (1995 points)": the size the GW app adds to a list's name. */
const POINTS_SUFFIX = new RegExp(`\\s*\\(\\s*[\\d.,\\s]+${POINTS_WORD}\\s*\\)\\s*$`, "i");

/**
 * The list's name, from the title above it in an export or a roster's name:
 * its first line, without the points the GW app adds. Lines below it are a
 * description, not the name.
 */
export function listTitle(note: string | undefined): string | undefined {
  const first = note?.replace(POINTS_SUFFIX, "").split("\n")[0]?.trim();
  return first || undefined;
}

/** The name the cover shows, if it shows one: the list's own, else the one you gave it. */
export function coverTitle(army: Army, settings: CoverSettings): string | undefined {
  if (!settings.listName) return undefined;
  return listTitle(army.note) ?? (settings.name.trim() || undefined);
}

/**
 * Which list a cover belongs to: its faction and name, so the cover stays
 * when units change (and with them the points in the name).
 */
export function coverKey(army: Army): string {
  return `${army.faction}|${listTitle(army.note) ?? ""}`.toLowerCase();
}

/** The points the list spends, and the battle size it's for: "Strike Force · 1,995 points". */
export function pointsLine(army: Army): string {
  const spent = army.units.reduce((sum, unit) => sum + unit.points, 0);
  const points = `${spent.toLocaleString("en")} points`;
  return army.battleSize ? `${army.battleSize.name} · ${points}` : points;
}
