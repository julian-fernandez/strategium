import type { Army, DataVersions } from "../../shared/types";
import { DEFAULT_DECK_OPTIONS, type DeckOptions } from "./cards/printOrder";

export type ListSource = { text: string } | { url: string };

export async function fetchArmy(source: ListSource): Promise<{ army: Army; text: string }> {
  const response = await fetch("/api/army", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(source),
  });
  const body = (await response.json()) as { army: Army; text: string } | { error: string };
  if ("error" in body) throw new Error(body.error);
  return body;
}

export async function fetchMeta(): Promise<DataVersions> {
  const response = await fetch("/api/meta");
  return (await response.json()) as DataVersions;
}

export async function checkForUpdates(): Promise<DataVersions> {
  const response = await fetch("/api/updates/check", { method: "POST" });
  return (await response.json()) as DataVersions;
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
