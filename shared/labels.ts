import type { Datasheet } from "./types";

/**
 * Numbers units that share a name, in list order, so they can be told apart at
 * the table: "Paragon Warsuits #1", "#2", "#3". Units with a unique name get
 * no number.
 */
export function duplicateNumbers(units: Datasheet[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const unit of units) totals.set(unit.name, (totals.get(unit.name) ?? 0) + 1);

  const seen = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const unit of units) {
    if ((totals.get(unit.name) ?? 0) < 2) continue;
    const next = (seen.get(unit.name) ?? 0) + 1;
    seen.set(unit.name, next);
    numbers.set(unit.id, next);
  }
  return numbers;
}

/** "Paragon Warsuits #2", or just the name when the unit isn't numbered. */
export function unitLabel(unit: Datasheet, numbers: Map<string, number>): string {
  const number = numbers.get(unit.id);
  return number ? `${unit.name} #${number}` : unit.name;
}
