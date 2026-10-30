import type { FactionBundle, ItemData, ModelData, UnitData } from "./bundle";

/**
 * A faction bundle as it's stored and sent, without the repetition a compiled
 * one carries: every character lists the same enhancements, and most models
 * list the same options as their unit. An item several units share is kept
 * once in `shared`, and a unit's entry for it is 0; a model's option that's
 * the same as its unit's is 0 too. Keys stay in their order, since a loose
 * name match takes the first item that fits.
 */
export type StoredBundle = Omit<FactionBundle, "units"> & {
  units: Record<string, StoredUnit>;
  shared: Record<string, ItemData>;
};

type StoredItems = Record<string, ItemData | 0>;
type StoredModel = Omit<ModelData, "items"> & { items: StoredItems };
type StoredUnit = Omit<UnitData, "items" | "models"> & {
  items: StoredItems;
  models: Record<string, StoredModel>;
};

export function compactBundle(bundle: FactionBundle): StoredBundle {
  // For each item key, the version most units have, if two or more have it.
  const versions = new Map<string, Map<string, number>>();
  for (const unit of Object.values(bundle.units)) {
    for (const [key, item] of Object.entries(unit.items)) {
      const seen = versions.get(key) ?? new Map<string, number>();
      const json = JSON.stringify(item);
      seen.set(json, (seen.get(json) ?? 0) + 1);
      versions.set(key, seen);
    }
  }
  const shared: Record<string, ItemData> = {};
  const sharedJson = new Map<string, string>();
  for (const [key, seen] of versions) {
    const [json, count] = [...seen].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!json || !count || count < 2) continue;
    shared[key] = JSON.parse(json) as ItemData;
    sharedJson.set(key, json);
  }

  const units: Record<string, StoredUnit> = {};
  for (const [unitKey, unit] of Object.entries(bundle.units)) {
    const own = (key: string, item: ItemData) =>
      JSON.stringify(item) === JSON.stringify(unit.items[key]);
    units[unitKey] = {
      ...unit,
      items: mapItems(unit.items, (key, item) =>
        sharedJson.get(key) === JSON.stringify(item) ? 0 : item,
      ),
      models: Object.fromEntries(
        Object.entries(unit.models).map(([modelKey, model]) => [
          modelKey,
          { ...model, items: mapItems(model.items, (key, item) => (own(key, item) ? 0 : item)) },
        ]),
      ),
    };
  }
  return { ...bundle, units, shared };
}

/** The bundle as the engine uses it, every unit and model with its own items again. */
export function hydrateBundle(stored: StoredBundle): FactionBundle {
  const { shared, ...rest } = stored;
  const units: Record<string, UnitData> = {};
  for (const [unitKey, unit] of Object.entries(stored.units)) {
    const items = mapItems(unit.items, (key, item) => (item === 0 ? shared[key] : item));
    units[unitKey] = {
      ...unit,
      items,
      models: Object.fromEntries(
        Object.entries(unit.models).map(([modelKey, model]) => [
          modelKey,
          {
            ...model,
            items: mapItems(model.items, (key, item) => (item === 0 ? items[key] : item)),
          },
        ]),
      ),
    };
  }
  return { ...rest, units };
}

function mapItems<In, Out>(
  items: Record<string, In>,
  map: (key: string, item: In) => Out | undefined,
): Record<string, Exclude<Out, undefined>> {
  const out: Record<string, Exclude<Out, undefined>> = {};
  for (const [key, item] of Object.entries(items)) {
    const mapped = map(key, item);
    if (mapped !== undefined) out[key] = mapped as Exclude<Out, undefined>;
  }
  return out;
}
