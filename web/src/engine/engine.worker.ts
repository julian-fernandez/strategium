import * as Comlink from "comlink";
import type { FactionBundle } from "../../../shared/bundle";
import { readList } from "../../../shared/list/formats";
import { readRosz } from "../../../shared/list/roster";
import { buildArmy } from "../../../shared/resolve/army";
import { applyEdits } from "../../../shared/resolve/edits";
import type { Army, Edit } from "../../../shared/types";
import { api, read, unwrap } from "../client";

/** Pasted text, a Listhammer link, or a file (a .ros, .rosz, .json or .txt export). */
export type ListSource =
  | { text: string }
  | { url: string }
  | { file: { name: string; bytes: ArrayBuffer } };

/** An army, and how many of the edits asked for no longer fit its list. */
export type Built = { army: Army; skipped: number };

/**
 * The army engine, off the main thread: reads the list in whatever format it
 * came in, fetches the faction's compiled bundle, and builds the army from it,
 * with any swaps made since. The server only compiles bundles; every list is
 * resolved here.
 */
const engine = {
  /**
   * Reads a list and builds its army. `saved` edits are replayed only on the
   * text they were made to: a linked list that changed at its source drops them.
   */
  async build(
    source: ListSource,
    saved?: { text: string; edits: Edit[] },
  ): Promise<Built & { text: string; edits: Edit[]; dropped: number }> {
    bundles.clear();
    const text = await sourceText(source);
    const edits = saved && saved.text === text ? saved.edits : [];
    const dropped = saved && saved.text !== text ? saved.edits.length : 0;
    return { ...(await resolve(text, edits)), text, edits, dropped };
  },

  /** The list already read, again with these edits: a linked list isn't fetched again. */
  rebuild(text: string, edits: Edit[]): Promise<Built> {
    return resolve(text, edits);
  },
};

async function resolve(text: string, edits: Edit[]): Promise<Built> {
  const [{ list, format, bundle }, versions] = await Promise.all([
    readList(text, fetchBundle),
    api.meta.$get().then(read),
  ]);
  const edited = applyEdits(list, bundle, edits);
  // An edited list's own points are out of date by design, so they aren't compared.
  const army = buildArmy(edited.list, bundle, versions, format, { checkPoints: !edits.length });
  return { army, skipped: edited.skipped };
}

async function sourceText(source: ListSource): Promise<string> {
  if ("text" in source) return source.text;
  if ("url" in source) {
    const response = await api.listhammer.$post({ json: { url: source.url } });
    return unwrap(await read(response)).text;
  }
  const bytes = new Uint8Array(source.file.bytes);
  // A .rosz is a zipped .ros; the XML inside is what gets read (and remembered).
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readRosz(bytes);
  return new TextDecoder().decode(bytes);
}

/** Bundles fetched since the list was loaded, so each swap rebuilds without a round trip. */
const bundles = new Map<string, Promise<FactionBundle>>();

function fetchBundle(faction: string): Promise<FactionBundle> {
  let pending = bundles.get(faction);
  if (!pending) {
    pending = api.bundle
      .$get({ query: { faction } })
      .then(read)
      .then((body) => unwrap(body).bundle);
    pending.catch(() => bundles.delete(faction));
    bundles.set(faction, pending);
  }
  return pending;
}

export type Engine = typeof engine;

Comlink.expose(engine);
