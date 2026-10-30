import { normalizeName } from "../bsdata/catalogues";
import type { FactionBundle, UnitData } from "../bundle";
import type { ArmyList, ListItem, ListModelGroup } from "../list/types";
import type { Edit } from "../types";
import { findUnit } from "./datasheet";
import { matchItem, matchModel } from "./match";

/**
 * The list with the swaps made since it was read, in order. A swap takes its
 * items out of wherever the list counts them (the model's own line first) and
 * puts the new ones on the same line, so a lumped squad ("9x Dominion") stays
 * lumped; a list that already names the new model type moves the model to it.
 * A swap that no longer fits the list (its source changed) is skipped.
 */
export function applyEdits(
  list: ArmyList,
  bundle: FactionBundle,
  edits: Edit[],
): { list: ArmyList; skipped: number } {
  const out = structuredClone(list);
  let skipped = 0;
  for (const edit of edits) {
    const unit = out.units[edit.unit];
    const data = unit ? findUnit(bundle, unit.name) : undefined;
    if (!unit || !data) {
      skipped++;
      continue;
    }
    const before = structuredClone(unit);
    for (let made = 0; made < (edit.times ?? 1); made++) {
      if (applyEdit(unit, data, edit)) continue;
      out.units[edit.unit] = before;
      skipped++;
      break;
    }
  }
  return { list: out, skipped };
}

type Line = { items: ListItem[]; group?: ListModelGroup };

function applyEdit(unit: ArmyList["units"][number], data: UnitData, edit: Edit): boolean {
  const modelKey = (group: ListModelGroup) =>
    matchModel(
      data,
      group.name,
      group.items.map((item) => item.name),
    )?.key;
  const own = unit.groups.find((group) => modelKey(group) === normalizeName(edit.model));
  const target = edit.toModel
    ? unit.groups.find((group) => modelKey(group) === normalizeName(edit.toModel))
    : undefined;
  // The model's own line first, then the rest of the squad, then the unit's own items.
  const lines: Line[] = [
    ...(own ? [{ items: own.items, group: own }] : []),
    ...unit.groups.filter((group) => group !== own).map((group) => ({ items: group.items, group })),
    { items: unit.items },
  ];
  const itemKey = (name: string) =>
    matchItem([data.items], name)?.key.split(":")[0] ?? normalizeName(name);

  let takenFrom: Line | undefined;
  for (const wanted of edit.remove) {
    let need = wanted.count;
    for (const line of lines) {
      for (const item of line.items) {
        if (need <= 0 || itemKey(item.name) !== normalizeName(wanted.name)) continue;
        const take = Math.min(need, item.count);
        item.count -= take;
        need -= take;
        takenFrom ??= line;
      }
    }
    if (need > 0) return false;
  }

  const into: Line = target
    ? { items: target.items, group: target }
    : (takenFrom ?? (own ? { items: own.items, group: own } : { items: unit.items }));
  for (const item of edit.add) {
    const existing = into.items.find((i) => itemKey(i.name) === normalizeName(item.name));
    if (existing) existing.count += item.count;
    else into.items.push({ name: item.name, count: item.count });
  }
  // A list that names the new model type gets the model moved over to it.
  if (own && target && own !== target) {
    own.count -= 1;
    target.count += 1;
  }

  for (const line of lines) {
    const kept = line.items.filter((item) => item.count > 0);
    line.items.splice(0, line.items.length, ...kept);
  }
  unit.groups = unit.groups.filter((group) => group.count > 0);
  return true;
}
