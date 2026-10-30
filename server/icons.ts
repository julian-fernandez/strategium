import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { factionIconPath } from "../shared/icons";
import { fetchFactionIcon } from "./sources";
import { CACHE_DIR } from "./store";

const ICON_DIR = path.join(CACHE_DIR, "icons");
const pending = new Map<string, Promise<string | undefined>>();

/**
 * A faction's emblem as SVG text, fetched from the icon set the first time
 * and kept in the data cache after. Undefined when the set has none for the
 * faction, or it can't be fetched, so the app keeps its own emblem.
 */
export function factionIcon(faction: string): Promise<string | undefined> {
  const iconPath = factionIconPath(faction);
  if (!iconPath) return Promise.resolve(undefined);
  let icon = pending.get(iconPath);
  if (!icon) {
    icon = loadIcon(iconPath).catch((error) => {
      console.warn(`No emblem for ${faction}: ${error instanceof Error ? error.message : error}`);
      pending.delete(iconPath);
      return undefined;
    });
    pending.set(iconPath, icon);
  }
  return icon;
}

async function loadIcon(iconPath: string): Promise<string | undefined> {
  const file = path.join(ICON_DIR, iconPath);
  if (existsSync(file)) return readFile(file, "utf8");
  const svg = await fetchFactionIcon(iconPath);
  if (!isPlainSvg(svg)) throw new Error(`${iconPath} isn't a plain SVG image.`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, svg);
  return svg;
}

/** An SVG with nothing in it that runs: no scripts, event handlers or javascript: links. */
function isPlainSvg(text: string): boolean {
  return (
    text.length < 512_000 &&
    /<svg[\s>]/i.test(text) &&
    !/<script|\son\w+\s*=|javascript:|<foreignObject/i.test(text)
  );
}
