import type { FactionBundle, ItemData, UnitData } from "../bundle";

/**
 * A bundle cut down to the given units with every piece of rules prose
 * removed: names, numbers and keywords stay, descriptions become empty. It's
 * what the repo commits as test data, so tests run without `pnpm sync-data`
 * and the repo carries no rules text.
 */
export function trimBundle(bundle: FactionBundle, unitKeys: Iterable<string>): FactionBundle {
  const units: FactionBundle["units"] = {};
  for (const key of unitKeys) {
    const unit = bundle.units[key];
    if (unit) units[key] = trimUnit(unit);
  }
  return {
    ...bundle,
    units,
    detachments: bundle.detachments.map((detachment) => ({
      ...detachment,
      rules: detachment.rules.map(stripHtml),
      enhancements: detachment.enhancements.map(stripHtml),
    })),
    stratagems: bundle.stratagems.map((stratagem) => ({ ...stratagem, html: "", when: "" })),
    rules: Object.fromEntries(
      Object.entries(bundle.rules).map(([key, rule]) => [key, stripHtml(rule)]),
    ),
  };
}

function trimUnit(unit: UnitData): UnitData {
  return {
    ...unit,
    abilities: unit.abilities.map(stripHtml),
    attachTo: unit.attachTo ? stripHtml(unit.attachTo) : undefined,
    items: trimItems(unit.items),
    models: Object.fromEntries(
      Object.entries(unit.models).map(([key, model]) => [
        key,
        { ...model, items: trimItems(model.items) },
      ]),
    ),
    wahapedia: unit.wahapedia ? { ...unit.wahapedia, legend: "" } : undefined,
  };
}

function trimItems(items: Record<string, ItemData>): Record<string, ItemData> {
  return Object.fromEntries(
    Object.entries(items).map(([key, item]) => [
      key,
      { ...item, abilities: item.abilities.map(stripHtml) },
    ]),
  );
}

function stripHtml<T extends { html: string }>(value: T): T {
  return { ...value, html: "" };
}
