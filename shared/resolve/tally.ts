/**
 * What a unit's list lines add up to, in BSData's names: how many models of
 * each type, and which options they took. Points and swaps are worked out
 * from it. Lists differ in how much they say about who carries what (the
 * official app lumps a squad's troopers together; a hand-written list may name
 * only totals), so items the list doesn't tie to a model are kept apart.
 */
export type Tally = {
  /** Models of each type the list names, by model key. */
  models: Map<string, number>;
  modelCount: number;
  /** Every option taken, by item key. */
  items: Map<string, number>;
  /** Options listed under each model type, by model key, then item key. */
  carried: Map<string, Map<string, number>>;
  /** Options the list gives at the unit's level, or under a model BSData doesn't have. */
  loose: Map<string, number>;
};

export function emptyTally(): Tally {
  return {
    models: new Map(),
    modelCount: 0,
    items: new Map(),
    carried: new Map(),
    loose: new Map(),
  };
}

export function addCount(map: Map<string, number>, key: string, count: number): void {
  map.set(key, (map.get(key) ?? 0) + count);
}
