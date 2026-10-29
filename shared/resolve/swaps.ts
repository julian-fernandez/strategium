import { normalizeName } from "../bsdata/catalogues";
import type { ChoiceData, Counted, ModelData, UnitData } from "../bundle";
import type { Swap } from "../types";
import { addCount, type Tally } from "./tally";

/** Item counts by item key. */
type Bag = Map<string, number>;

/** One model's wargear: what it holds and what its choices cost. */
type Loadout = { items: Counted[]; cost: number };

type ModelState = {
  key: string;
  model: ModelData;
  count: number;
  /** What its models hold beyond their fixed wargear: the choices they took. */
  held: Bag;
};

/**
 * Every swap one model of the unit could make, by the item it gives up, and
 * the wargear a model could add without giving anything up.
 *
 * Two kinds: a different choice in one of the model's pick-one slots (a
 * Canoness's blessed blade for her chainsword), and a different model type
 * from its squad group, which is how BSData gives a trooper a special weapon
 * (a Dominion becomes a "Dominion w/ Special Weapon" with a meltagun). Lists
 * rarely say which trooper holds what, so who holds which choice is worked
 * out from the totals; the limits on each model type come from BSData.
 */
export function unitSwaps(
  data: UnitData,
  tally: Tally,
  label: (model: string) => string,
): { byItem: Map<string, Swap[]>; extras: Swap[] } {
  const states = modelStates(data, tally);
  const byItem = new Map<string, Swap[]>();
  const extras: Swap[] = [];
  const seen = new Set<string>();

  const offer = (swap: Swap) => {
    const signature = JSON.stringify([swap.model, swap.toModel, swap.remove, swap.add]);
    if (seen.has(signature)) return;
    seen.add(signature);
    if (!swap.remove.length) {
      extras.push(swap);
      return;
    }
    for (const item of swap.remove) {
      const key = normalizeName(item.name);
      byItem.set(key, [...(byItem.get(key) ?? []), swap]);
    }
  };

  const squad = states.size > 1;
  for (const state of states.values()) {
    if (state.count <= 0) continue;
    const { model } = state;
    // A squad's leader goes by its rank ("Superior"); anything else by its own name.
    const leader = squad && model.min === 1 && model.max === 1;
    const modelLabel = leader ? label(model.name) : model.name;

    // Another choice in one of its slots.
    for (const slot of model.slots) {
      const held = slot.choices.filter((choice) => fits(state.held, choice.items) > 0);
      for (const choice of held) {
        for (const other of slot.choices) {
          if (other === choice) continue;
          offer({
            model: model.name,
            modelLabel,
            remove: choice.items,
            add: other.items,
            label: other.name,
            cost: other.cost - choice.cost,
          });
        }
        if (slot.min === 0) {
          offer({
            model: model.name,
            modelLabel,
            remove: choice.items,
            add: [],
            label: `No ${choice.name}`,
            cost: -choice.cost,
          });
        }
      }
      // An optional slot with nothing in it: each choice is an addition.
      if (slot.min === 0 && !held.length) {
        for (const choice of slot.choices) {
          offer({
            model: model.name,
            modelLabel,
            remove: [],
            add: choice.items,
            label: choice.name,
            cost: choice.cost,
          });
        }
      }
    }

    // Another model type from its squad group: one model changes, so the squad keeps its size.
    if (!model.group) continue;
    const mine = loadouts(model, state.held);
    for (const other of states.values()) {
      if (other === state || other.model.group !== model.group) continue;
      const blocked =
        other.model.max > 0 && other.count >= other.model.max
          ? `The squad already has ${other.count} of the ${other.model.max} allowed.`
          : model.min > 0 && state.count <= model.min
            ? `The squad must keep ${model.min} ${model.name}.`
            : undefined;
      for (const from of mine) {
        for (const to of loadouts(other.model)) {
          const remove = minus(from.items, to.items);
          const add = minus(to.items, from.items);
          if (!add.length && !remove.length) continue;
          offer({
            model: model.name,
            modelLabel,
            toModel: other.model.name,
            remove,
            add,
            // Giving something up for nothing: "No Simulacrum Imperialis".
            label: add.length
              ? add
                  .map((item) => (item.count > 1 ? `${item.count}× ${item.name}` : item.name))
                  .join(" + ")
              : `No ${remove.map((item) => item.name).join(" or ")}`,
            cost: to.cost + other.model.cost - from.cost - model.cost,
            blocked,
          });
        }
      }
    }
  }
  return { byItem, extras };
}

/**
 * How many models of each type the unit has, and what they hold. Lists that
 * name every model type are taken at their word; lumped squads ("9x Dominion"
 * holding four meltaguns) are split by the wargear only one type can carry.
 */
function modelStates(data: UnitData, tally: Tally): Map<string, ModelState> {
  const states = new Map<string, ModelState>();
  for (const [key, model] of Object.entries(data.models)) {
    states.set(key, {
      key,
      model,
      count: tally.models.get(key) ?? 0,
      held: new Map(tally.carried.get(key) ?? []),
    });
  }
  // A single-model unit lists its wargear at the unit's level.
  const present = [...states.values()].filter((s) => s.count > 0);
  if (!present.length && states.size === 1) {
    const [only] = states.values();
    if (only) {
      only.count = 1;
      present.push(only);
    }
  }

  const loose = new Map(tally.loose);
  if (present.length === 1 && present[0]) {
    for (const [key, count] of loose) addCount(present[0].held, key, count);
    loose.clear();
  } else {
    // Wargear listed at the unit's level goes to the models outside squad groups
    // that the list gives none of their own, fewest first (the leader): their
    // fixed wargear, then for each slot whichever choices the totals have.
    const take = (state: ModelState, item: Counted, count: number) => {
      const key = normalizeName(item.name);
      const taken = Math.min(loose.get(key) ?? 0, count);
      if (!taken) return;
      addCount(state.held, key, taken);
      loose.set(key, (loose.get(key) ?? 0) - taken);
    };
    const bare = present
      .filter((state) => !state.model.group && !state.held.size)
      .sort((a, b) => a.count - b.count);
    for (const state of bare) {
      for (const item of state.model.fixed) take(state, item, item.count * state.count);
      for (const slot of state.model.slots) {
        let models = state.count;
        for (const choice of slot.choices) {
          const n = Math.min(models, fits(loose, choice.items));
          if (n <= 0) continue;
          for (const item of choice.items) take(state, item, item.count * n);
          models -= n;
        }
      }
    }
  }

  // Squad groups: pool what the group's models hold with what's left loose, then split it by type.
  const groups = new Map<string, ModelState[]>();
  for (const state of states.values()) {
    if (state.model.group)
      groups.set(state.model.group, [...(groups.get(state.model.group) ?? []), state]);
  }
  let looseUsed = false;
  for (const members of groups.values()) {
    const total = members.reduce((sum, m) => sum + m.count, 0);
    if (!total) continue;
    const pool: Bag = new Map();
    for (const member of members)
      for (const [key, count] of member.held) addCount(pool, key, count);
    if (!looseUsed) {
      for (const [key, count] of loose) addCount(pool, key, count);
      looseUsed = true;
    }
    const plain: ModelState[] = [];
    let counted = 0;
    for (const member of members) {
      const own = distinctive(member.model, members);
      if (!own.size) {
        plain.push(member);
        continue;
      }
      // Its fixed wargear only it carries, or the choices only it can make, summed across each slot.
      let inferred = 0;
      for (const item of member.model.fixed) {
        const key = normalizeName(item.name);
        if (own.has(key))
          inferred = Math.max(inferred, Math.ceil((pool.get(key) ?? 0) / item.count));
      }
      for (const slot of member.model.slots) {
        const choices = slot.choices.filter((c) =>
          c.items.every((i) => own.has(normalizeName(i.name))),
        );
        inferred = Math.max(
          inferred,
          choices.reduce((sum, c) => sum + fits(pool, c.items), 0),
        );
      }
      member.count = Math.min(total, Math.max(member.count, inferred));
      counted += member.count;
    }
    if (plain.length === 1 && plain[0]) plain[0].count = Math.max(0, total - counted);
    // What's left once every model's fixed wargear is taken out is the choices they made.
    const left = new Map(pool);
    for (const member of members) {
      for (const item of member.model.fixed) {
        const key = normalizeName(item.name);
        left.set(key, Math.max(0, (left.get(key) ?? 0) - item.count * member.count));
      }
    }
    for (const member of members) member.held = member.count ? new Map(left) : new Map();
  }

  for (const state of states.values()) {
    if (state.model.group || !state.count) continue;
    for (const item of state.model.fixed) {
      const key = normalizeName(item.name);
      state.held.set(key, Math.max(0, (state.held.get(key) ?? 0) - item.count * state.count));
    }
    // A list that names no wargear for it: its slots hold their defaults.
    for (const slot of state.model.slots) {
      if (slot.choices.some((choice) => fits(state.held, choice.items) > 0)) continue;
      const fallback = slot.choices.find((choice) => choice.name === slot.default);
      if (fallback) {
        for (const item of fallback.items) {
          addCount(state.held, normalizeName(item.name), item.count * state.count);
        }
      }
    }
  }
  return states;
}

/** Wargear only this model type carries in its group, with how many each one holds. */
function distinctive(model: ModelData, members: ModelState[]): Map<string, number> {
  const carries = (m: ModelData) => {
    const out = new Map<string, number>();
    for (const item of [
      ...m.fixed,
      ...m.slots.flatMap((slot) => slot.choices.flatMap((c) => c.items)),
    ]) {
      const key = normalizeName(item.name);
      out.set(key, Math.max(out.get(key) ?? 0, item.count));
    }
    return out;
  };
  const own = carries(model);
  for (const member of members) {
    if (member.model === model) continue;
    for (const key of carries(member.model).keys()) own.delete(key);
  }
  return own;
}

/** The loadouts a model of this type can have: its defaults, then each slot's other choices in turn. */
function loadouts(model: ModelData, held?: Bag): Loadout[] {
  const base = defaultLoadout(model);
  const out: Loadout[] = [];
  const add = (slotIndex: number, choice: ChoiceData) => {
    const items: Counted[] = [...model.fixed];
    let cost = 0;
    model.slots.forEach((slot, index) => {
      const pick = index === slotIndex ? choice : slot.choices.find((c) => c.name === slot.default);
      if (!pick) return;
      items.push(...pick.items);
      cost += pick.cost;
    });
    out.push({ items: merge(items), cost });
  };
  if (!held) {
    out.push(base);
    model.slots.forEach((slot, index) => {
      for (const choice of slot.choices) if (choice.name !== slot.default) add(index, choice);
    });
    return out;
  }
  // The loadouts its models hold now: each slot choice the totals show, the others at their defaults.
  if (!model.slots.length) return [base];
  model.slots.forEach((slot, index) => {
    for (const choice of slot.choices) if (fits(held, choice.items) > 0) add(index, choice);
  });
  return out.length ? out : [base];
}

function defaultLoadout(model: ModelData): Loadout {
  const items: Counted[] = [...model.fixed];
  let cost = 0;
  for (const slot of model.slots) {
    const pick = slot.choices.find((c) => c.name === slot.default);
    if (!pick) continue;
    items.push(...pick.items);
    cost += pick.cost;
  }
  return { items: merge(items), cost };
}

/** How many times a choice's items fit in what's held. */
function fits(held: Bag, items: Counted[]): number {
  if (!items.length) return 0;
  return Math.min(
    ...items.map((item) => Math.floor((held.get(normalizeName(item.name)) ?? 0) / item.count)),
  );
}

function merge(items: Counted[]): Counted[] {
  const out: Counted[] = [];
  for (const item of items) {
    const existing = out.find((o) => normalizeName(o.name) === normalizeName(item.name));
    if (existing) existing.count += item.count;
    else out.push({ ...item });
  }
  return out;
}

/** The items in `a` that `b` doesn't have, counted. */
function minus(a: Counted[], b: Counted[]): Counted[] {
  const out: Counted[] = [];
  for (const item of a) {
    const theirs = b.find((o) => normalizeName(o.name) === normalizeName(item.name))?.count ?? 0;
    if (item.count > theirs) out.push({ name: item.name, count: item.count - theirs });
  }
  return out;
}
