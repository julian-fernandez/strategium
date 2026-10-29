import { normalizeName } from "../bsdata/catalogues";
import type { FactionBundle, PointsCount, PointsData, UnitData } from "../bundle";
import type { Tally } from "./tally";

/**
 * What a unit costs: its price for its size, what its models and options cost
 * on top (a meltagun, a multi-melta), its enhancement, and what a repeated
 * datasheet adds for each copy before it in the army.
 */
export function unitPoints(
  bundle: FactionBundle,
  data: UnitData,
  tally: Tally,
  enhancement: string | undefined,
  copiesBefore: number,
): number {
  const { repeat } = data.points;
  let total = price(data.points, tally);
  if (repeat && copiesBefore >= repeat.after) total += repeat.value;
  for (const [key, count] of tally.models) total += (data.models[key]?.cost ?? 0) * count;
  const enhancementKey = enhancement ? normalizeName(enhancement) : undefined;
  for (const [key, count] of tally.items) {
    if (key !== enhancementKey) total += (data.costs[key] ?? 0) * count;
  }
  if (enhancementKey) total += enhancementCost(bundle, data, enhancementKey);
  return total;
}

/** The unit's own price: its base cost with each rule whose counts hold applied in turn. */
export function price(points: PointsData, tally: Tally): number {
  let value = points.base;
  for (const rule of points.rules) {
    if (!rule.when.every((count) => holds(count, tally))) continue;
    if (rule.op === "set") value = rule.value;
    else if (rule.op === "increment") value += rule.value;
    else if (rule.op === "decrement") value -= rule.value;
    else value *= rule.value;
  }
  return value;
}

function holds(count: PointsCount, tally: Tally): boolean {
  const actual = count.models
    ? count.models.reduce((sum, key) => sum + (tally.models.get(key) ?? 0), 0)
    : count.item
      ? (tally.items.get(count.item) ?? 0)
      : tally.modelCount;
  switch (count.compare) {
    case "atLeast":
      return actual >= count.value;
    case "greaterThan":
      return actual > count.value;
    case "atMost":
      return actual <= count.value;
    case "lessThan":
      return actual < count.value;
    case "equalTo":
      return actual === count.value;
    case "notEqualTo":
      return actual !== count.value;
  }
}

/** BSData's price for the enhancement on this character, else its detachment's on Wahapedia. */
function enhancementCost(bundle: FactionBundle, data: UnitData, key: string): number {
  const own = data.costs[key];
  if (own !== undefined) return own;
  const plain = (name: string) => normalizeName(name.replace(/\s*\([^)]*\)\s*$/, ""));
  for (const detachment of bundle.detachments) {
    const found = detachment.enhancements.find((e) => plain(e.name) === plain(key));
    if (found) return Number.parseInt(found.cost, 10) || 0;
  }
  return 0;
}
