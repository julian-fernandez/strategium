import * as Comlink from "comlink";
import type { FactionBundle } from "../../../shared/bundle";
import { readList } from "../../../shared/list/formats";
import { readRosz } from "../../../shared/list/roster";
import { buildArmy } from "../../../shared/resolve/army";
import type { Army } from "../../../shared/types";
import { api, unwrap } from "../client";

/** Pasted text, a Listhammer link, or a file (a .ros, .rosz, .json or .txt export). */
export type ListSource =
  | { text: string }
  | { url: string }
  | { file: { name: string; bytes: ArrayBuffer } };

/**
 * The army engine, off the main thread: reads the list in whatever format it
 * came in, fetches the faction's compiled bundle, and builds the army from it.
 * The server only compiles bundles; every list is resolved here.
 */
const engine = {
  async build(source: ListSource): Promise<{ army: Army; text: string }> {
    const text = await sourceText(source);
    const [{ list, format, bundle }, versions] = await Promise.all([
      readList(text, fetchBundle),
      api.meta.$get().then((r) => r.json()),
    ]);
    return { army: buildArmy(list, bundle, versions, format), text };
  },
};

async function sourceText(source: ListSource): Promise<string> {
  if ("text" in source) return source.text;
  if ("url" in source) {
    const response = await api.listhammer.$post({ json: { url: source.url } });
    return unwrap(await response.json()).text;
  }
  const bytes = new Uint8Array(source.file.bytes);
  // A .rosz is a zipped .ros; the XML inside is what gets read (and remembered).
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readRosz(bytes);
  return new TextDecoder().decode(bytes);
}

async function fetchBundle(faction: string): Promise<FactionBundle> {
  const response = await api.bundle.$get({ query: { faction } });
  return unwrap(await response.json()).bundle;
}

export type Engine = typeof engine;

Comlink.expose(engine);
