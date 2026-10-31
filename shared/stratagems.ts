import { stripTags } from "./markup";
import type { Stratagem } from "./types";
import type { WahapediaStratagem } from "./wahapedia";

const PHASES = ["command", "movement", "shooting", "charge", "fight", "any"];

/**
 * Wahapedia's 11th-edition export still carries 10th-edition core stratagems
 * ("Core – Battle Tactic Stratagem"). The 11th-edition ones are typed
 * "Core Stratagem", plus New Orders as "Core Stratagem – Strategic Ploy".
 */
export function isCoreStratagem(stratagem: WahapediaStratagem): boolean {
  return (
    stratagem.factionId === "" &&
    (stratagem.type === "Core Stratagem" || stratagem.type.startsWith("Core Stratagem –"))
  );
}

/** Wahapedia keeps several copies of New Orders; the highest id is the current one. */
export function latestByName(stratagems: WahapediaStratagem[]): WahapediaStratagem[] {
  const byName = new Map<string, WahapediaStratagem>();
  for (const stratagem of stratagems) {
    const existing = byName.get(stratagem.name);
    if (!existing || stratagem.id > existing.id) byName.set(stratagem.name, stratagem);
  }
  return [...byName.values()];
}

/**
 * A stratagem's section labels as one form, `<b>WHEN:</b>`. A few are written
 * `<b>WHEN</b>:` or as a plain `WHEN:` at the start of a line.
 */
export function boldLabels(description: string): string {
  return description
    .replace(/<b>\s*([A-Z][A-Z ]*?)\s*<\/b>\s*:/g, "<b>$1:</b>")
    .replace(/(^|<br>\s*)([A-Z][A-Z ]*[A-Z]):/g, "$1<b>$2:</b>");
}

/**
 * The text after "WHEN:", up to the next labelled section. A bulleted list in
 * it (Command Re-roll's rolls) becomes a comma-separated one.
 */
export function whenLine(description: string): string {
  const match = /<b>\s*WHEN:\s*<\/b>([\s\S]*?)(?=<b>\s*[A-Z ]+:\s*<\/b>|$)/i.exec(
    boldLabels(description),
  );
  if (!match) return "";
  return stripTags((match[1] ?? "").replace(/<\/li>\s*<li[^>]*>/gi, ", "));
}

export function phaseIndex(phase: string): number {
  const lower = phase.toLowerCase();
  const index = PHASES.findIndex((name) => lower.includes(name));
  return index === -1 ? PHASES.length : index;
}

/**
 * Who can use a stratagem, for a card or a list: "Every unit", "Every unit
 * except Leman Russ Battle Tank" when that's shorter than naming them, or the
 * names. Empty for one that targets no unit.
 */
export function usersOf(
  stratagem: Pick<Stratagem, "usableBy" | "notUsableBy" | "everyUnit">,
): string {
  if (stratagem.everyUnit) return "Every unit";
  if (!stratagem.usableBy.length) return "";
  const except = stratagem.notUsableBy;
  return except.length && except.length < stratagem.usableBy.length
    ? `Every unit except ${except.join(", ")}`
    : stratagem.usableBy.join(", ");
}
