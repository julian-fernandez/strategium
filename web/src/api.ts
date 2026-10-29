import type { DataVersions, Edit } from "../../shared/types";
import { DEFAULT_DECK_OPTIONS, type DeckOptions } from "./cards/printOrder";
import { api, read } from "./client";
import type { ListSource } from "./engine";

export type { ListSource };

export async function fetchMeta(): Promise<DataVersions> {
  return read(await api.meta.$get());
}

export async function checkForUpdates(): Promise<DataVersions> {
  return read(await api.updates.check.$post());
}

export const DEMO_LIST_URL = "https://listhammer.info/list/b29e2c836943545e89";

const STORAGE_KEY = "army-cards:source";

export function loadSavedSource(): ListSource | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ListSource) : undefined;
  } catch {
    return undefined;
  }
}

export function saveSource(source: ListSource | undefined): void {
  try {
    if (source) localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable; the list just won't be remembered.
  }
}

const EDITS_KEY = "army-cards:edits";

/** Swaps made to a list, with the list text they were made to, so they're only replayed on that list. */
export type SavedEdits = { text: string; edits: Edit[] };

export function loadSavedEdits(): SavedEdits | undefined {
  try {
    const raw = localStorage.getItem(EDITS_KEY);
    return raw ? (JSON.parse(raw) as SavedEdits) : undefined;
  } catch {
    return undefined;
  }
}

export function saveEdits(saved: SavedEdits | undefined): void {
  try {
    if (saved?.edits.length) localStorage.setItem(EDITS_KEY, JSON.stringify(saved));
    else localStorage.removeItem(EDITS_KEY);
  } catch {
    // Storage can be unavailable; the edits just won't be remembered.
  }
}

const OPTIONS_KEY = "army-cards:options";

/** Saved card options over the defaults, so options added later get their default. */
export function loadSavedOptions(): DeckOptions {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    return { ...DEFAULT_DECK_OPTIONS, ...(raw ? (JSON.parse(raw) as Partial<DeckOptions>) : {}) };
  } catch {
    return DEFAULT_DECK_OPTIONS;
  }
}

export function saveOptions(options: DeckOptions): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Storage can be unavailable; the options just won't be remembered.
  }
}
