import { normalizeName } from "../bsdata/catalogues";
import type { FactionBundle, UnitData } from "../bundle";
import { findUnit } from "../resolve/datasheet";
import { looseName, matchItem, matchModel } from "../resolve/match";
import type { ArmyList, ListItem, ListModelGroup, ListUnit } from "./types";

/**
 * Puts back a unit whose name line an export lost. Its models' lines then sit
 * under the unit before ("Vigilators … 8x Vigilator" and then "4x Custodian
 * Warden, 4x Guardian spear, 1x Vexilla"). From the first line naming a model
 * of exactly one other unit, and nothing the unit it sits in has, the lines
 * are read as that unit, priced from the data, with a warning.
 */
export function splitStrayUnits(list: ArmyList, bundle: FactionBundle): ArmyList {
  const units: ListUnit[] = [];
  const warnings = [...list.warnings];
  for (const unit of list.units) {
    units.push(unit);
    const data = findUnit(bundle, unit.name);
    if (!data) continue;
    const knows = (holder: UnitData, name: string) =>
      Boolean(matchItem([holder.items], name, holder.aliases) || matchModel(holder, name));
    const foreign = (name: string) => (knows(data, name) ? undefined : ownerOf(bundle, name, data));

    // Only a block that's wholly the other unit's moves: an older list's model names
    // (Deathwatch Veterans from the last edition) still carry their unit's wargear.
    const group = unit.groups.findIndex((g) => foreign(g.name));
    const item = unit.items.findIndex((i) => foreign(i.name));
    const owner =
      group >= 0
        ? foreign(unit.groups[group]?.name ?? "")
        : item >= 0
          ? foreign(unit.items[item]?.name ?? "")
          : undefined;
    if (!owner) continue;
    const theirs = (name: string) => !knows(data, name) && knows(owner, name);
    const wholly =
      unit.groups.slice(Math.max(group, 0)).every((g) => {
        if (group < 0) return true;
        return theirs(g.name) && g.items.every((i) => knows(owner, i.name));
      }) && unit.items.slice(Math.max(item, 0)).every((i) => item < 0 || theirs(i.name));
    if (!wholly) continue;

    const groups: ListModelGroup[] = group >= 0 ? unit.groups.splice(group) : [];
    const items: ListItem[] = item >= 0 ? unit.items.splice(item) : [];
    units.push({
      name: owner.name,
      points: 0,
      section: unit.section,
      isWarlord: false,
      groups,
      items,
    });
    warnings.push(
      `The list has ${owner.name} models after ${unit.name} with no unit line of their own; they're read as a unit of ${owner.name}.`,
    );
  }
  return { ...list, units, warnings };
}

/** The one other unit that has a model by this name. */
function ownerOf(bundle: FactionBundle, name: string, not: UnitData): UnitData | undefined {
  const key = normalizeName(name);
  const loose = looseName(name);
  const owners = Object.values(bundle.units).filter(
    (unit) =>
      unit !== not &&
      !/legends|crucible/i.test(unit.name) &&
      Object.values(unit.models).some(
        (model) => normalizeName(model.name) === key || looseName(model.name) === loose,
      ),
  );
  return owners.length === 1 ? owners[0] : undefined;
}
