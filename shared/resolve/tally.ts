/**
 * What a unit's list lines add up to, in BSData's names: how many models of
 * each type, and which options they took. Its points are worked out from it.
 */
export type Tally = {
  /** Models of each type the list names, by model key. */
  models: Map<string, number>;
  modelCount: number;
  /** Every option taken, by item key. */
  items: Map<string, number>;
};

export function emptyTally(): Tally {
  return { models: new Map(), modelCount: 0, items: new Map() };
}

export function addCount(map: Map<string, number>, key: string, count: number): void {
  map.set(key, (map.get(key) ?? 0) + count);
}
