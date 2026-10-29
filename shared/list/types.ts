import type { AttachmentRole } from "../types";

/**
 * A list as read from any export format, before it meets the data: names and
 * counts exactly as the list gives them. Every parser produces this shape.
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
