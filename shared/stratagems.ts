import { sanitizeWahapediaHtml, stripTags } from "./markup";
import type { Datasheet, Stratagem } from "./types";
import type { Wahapedia, WahapediaStratagem } from "./wahapedia";

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

/**
 * Core stratagems plus those of the army's detachments, kept only when a unit
 * in the army can use them, or when they target no unit at all (New Orders).
 */
export function selectStratagems(
  data: Wahapedia,
  detachmentIds: string[],
  units: Datasheet[],
): Stratagem[] {
  const core = latestByName(data.stratagems.filter(isCoreStratagem));
  const detachment = data.stratagems.filter((s) => detachmentIds.includes(s.detachmentId));

  const unitNames = unique(units.map((unit) => unit.name));
  const selected: Stratagem[] = [];
  for (const stratagem of [...detachment, ...core]) {
    const usableBy = unique(
      units
        .filter(
          (unit) =>
            unit.wahapediaId && data.datasheetStratagems.get(unit.wahapediaId)?.has(stratagem.id),
        )
        .map((unit) => unit.name),
    );
    const targetsNoUnit = !data.unitStratagems.has(stratagem.id);
    if (usableBy.length === 0 && !targetsNoUnit) continue;

    selected.push({
      id: stratagem.id,
      name: stratagem.name,
      cp: stratagem.cp,
      type: stratagem.type,
      phase: stratagem.phase,
      turn: stratagem.turn,
      detachment: stratagem.detachment,
      html: sanitizeWahapediaHtml(stratagem.description),
      when: whenLine(stratagem.description),
      usableBy,
      everyUnit: usableBy.length === unitNames.length,
    });
  }

  return selected.sort(
    (a, b) =>
      phaseIndex(a.phase) - phaseIndex(b.phase) ||
      Number(a.detachment === "") - Number(b.detachment === "") ||
      a.name.localeCompare(b.name),
  );
}

/** The stratagems a set of units (e.g. a leader and its bodyguard) can use between them. */
export function stratagemsFor(
  data: Wahapedia,
  stratagems: Stratagem[],
  units: Datasheet[],
): string[] {
  const ids = new Set<string>();
  for (const unit of units) {
    const usable = unit.wahapediaId ? data.datasheetStratagems.get(unit.wahapediaId) : undefined;
    for (const stratagem of stratagems) if (usable?.has(stratagem.id)) ids.add(stratagem.id);
  }
  return stratagems.filter((s) => ids.has(s.id)).map((s) => s.id);
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

/** Wahapedia keeps several copies of New Orders; the highest id is the current one. */
function latestByName(stratagems: WahapediaStratagem[]): WahapediaStratagem[] {
  const byName = new Map<string, WahapediaStratagem>();
  for (const stratagem of stratagems) {
    const existing = byName.get(stratagem.name);
    if (!existing || stratagem.id > existing.id) byName.set(stratagem.name, stratagem);
  }
  return [...byName.values()];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
