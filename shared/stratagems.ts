import { stripTags } from "./markup";
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
 * The text after "WHEN:", up to the next labelled section. A bulleted list in
 * it (Command Re-roll's rolls) becomes a comma-separated one.
 */
export function whenLine(description: string): string {
  const match = /<b>\s*WHEN:\s*<\/b>([\s\S]*?)(?=<b>\s*[A-Z ]+:\s*<\/b>|$)/i.exec(description);
  if (!match) return "";
  return stripTags((match[1] ?? "").replace(/<\/li>\s*<li[^>]*>/gi, ", "));
}

export function phaseIndex(phase: string): number {
  const lower = phase.toLowerCase();
  const index = PHASES.findIndex((name) => lower.includes(name));
  return index === -1 ? PHASES.length : index;
}
