import { normalizeName } from "../bsdata/catalogues";
import type { ChoiceData, Counted, ModelData, UnitData } from "../bundle";
import type { LoadoutRow, Swap } from "../types";
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
 * The unit as a player reads a squad: each kind of model, how many there are
 * (and may be), what they all carry, and the choices they've made, each with
 * what one of them could take instead.
 *
 * BSData gives a trooper a special weapon by making it another model type (a
 * Dominion becomes a "Dominion w/ Special Weapon"), so those types are rows of
 * their own, labelled by what sets them apart ("Special Weapon"), with a way
 * for a trooper to join them while there's room. Lists rarely say which
 * trooper holds what, so who holds which choice is worked out from the totals.
 */
export function unitLoadout(
  data: UnitData,
  tally: Tally,
  label: (model: string) => string,
): LoadoutRow[] {
  const states = modelStates(data, tally);
  const squad = states.size > 1;
  const members = (group: string | undefined) =>
    [...states.values()].filter((s) => group && s.model.group === group);
  // A group's trooper: the one type it may have most of. Others are its specialists.
  const trooperOf = (group: string | undefined): ModelState | undefined => {
    const all = members(group);
    const most = Math.max(...all.map((m) => limitOf(m.model)));
    const top = all.filter((m) => limitOf(m.model) === most);
    return top.length === 1 ? top[0] : undefined;
  };

  const rows: { row: LoadoutRow; order: number }[] = [];
  for (const state of states.values()) {
    const { model } = state;
    const group = members(model.group);
    const trooper = trooperOf(model.group);
    const specialist = Boolean(model.group) && state !== trooper;
    // A specialist type the squad has none of still shows, so a trooper can become one.
    if (state.count <= 0 && !(specialist && trooper)) continue;

    const leader = squad && model.min === 1 && model.max === 1;
    const own = specialist ? distinctive(model, group) : new Map<string, number>();
    const marks = model.fixed.filter((item) => own.has(normalizeName(item.name)));
    const row: LoadoutRow = {
      model: model.name,
      label: leader
        ? label(model.name)
        : specialist
          ? apartFrom(model.name, (trooper ?? group.find((m) => m !== state))?.model.name ?? "")
          : model.name,
      count: state.count,
      // Only a specialist's limit means anything to a player ("4 of 4 special weapons").
      max: specialist && model.max > 0 ? model.max : undefined,
      fixed: model.fixed.filter((item) => !marks.includes(item)),
      picks: [],
      joins: [],
    };
    const swap = (fields: Omit<Swap, "model" | "modelLabel">): Swap => ({
      model: model.name,
      modelLabel: row.label,
      ...fields,
    });
    // Where one of these models can go instead: back to a trooper, or (with no trooper) any other type.
    const leaving = (from: Loadout): Swap[] => {
      const targets = trooper ? (specialist ? [trooper] : []) : group.filter((m) => m !== state);
      return targets.flatMap((target) =>
        loadouts(target.model).flatMap((to) => {
          const change = convert(state, target, from, to);
          return change ? [swap({ ...change, toLabel: labelOf(target) })] : [];
        }),
      );
    };
    const labelOf = (other: ModelState) =>
      other === trooper
        ? other.model.name
        : apartFrom(other.model.name, (trooper ?? state).model.name);

    if (state.count > 0) {
      model.slots.forEach((slot, index) => {
        const held = slot.choices
          .map((choice) => ({
            choice,
            count: Math.min(state.count, fits(state.held, choice.items)),
          }))
          .filter(({ count }) => count > 0);
        for (const { choice, count } of held) {
          row.picks.push({
            slot: slot.name,
            name: choice.name,
            items: choice.items,
            count,
            swaps: [
              ...slot.choices
                .filter((other) => other !== choice)
                .map((other) =>
                  swap({
                    remove: choice.items,
                    add: other.items,
                    label: other.name,
                    cost: other.cost - choice.cost,
                  }),
                ),
              ...(slot.min === 0
                ? [
                    swap({
                      remove: choice.items,
                      add: [],
                      label: `No ${choice.name}`,
                      cost: -choice.cost,
                    }),
                  ]
                : []),
              ...leaving(loadoutWith(model, index, choice)),
            ],
          });
        }
        // An optional slot with nothing in it: each choice can be added.
        if (slot.min === 0 && !held.length) {
          row.picks.push({
            slot: slot.name,
            name: "",
            items: [],
            count: 0,
            swaps: slot.choices.map((choice) =>
              swap({ remove: [], add: choice.items, label: choice.name, cost: choice.cost }),
            ),
          });
        }
      });
      // What sets a specialist apart without a slot (the Simulacrum, a mace): giving it up.
      if (marks.length) {
        row.picks.push({
          slot: "",
          name: marks.map((item) => item.name).join(" and "),
          items: marks,
          count: state.count,
          swaps: leaving(defaultLoadout(model)),
        });
      }
    }

    // A trooper becoming one of these, while there's room.
    if (specialist && trooper && trooper.count > 0) {
      const from = loadouts(trooper.model, trooper.held)[0] ?? defaultLoadout(trooper.model);
      row.joins = loadouts(model).flatMap((to) => {
        const change = convert(trooper, state, from, to);
        return change
          ? [
              {
                ...change,
                model: trooper.model.name,
                modelLabel: trooper.model.name,
                toLabel: row.label,
              },
            ]
          : [];
      });
      row.full = row.joins[0]?.blocked;
    }

    const order = leader ? 0 : !model.group ? 1 : specialist ? 3 : 2;
    rows.push({ row, order });
  }
  return rows.sort((a, b) => a.order - b.order).map(({ row }) => row);
}

/** One model of `from`'s type becoming `to`'s, with the loadouts given: what it gives up and gains, and why it can't. */
function convert(
  from: ModelState,
  to: ModelState,
  before: Loadout,
  after: Loadout,
): Omit<Swap, "model" | "modelLabel"> | undefined {
  const remove = minus(before.items, after.items);
  const add = minus(after.items, before.items);
  if (!add.length && !remove.length) return undefined;
  const blocked =
    to.model.max > 0 && to.count >= to.model.max
      ? to.model.max === 1
        ? "Only one per squad."
        : `All ${to.model.max} places taken.`
      : from.model.min > 0 && from.count <= from.model.min
        ? `The squad must keep ${from.model.min} ${from.model.name}.`
        : undefined;
  return {
    toModel: to.model.name,
    remove,
    add,
    // Giving something up for nothing: "No Simulacrum Imperialis".
    label: add.length
      ? add.map((item) => (item.count > 1 ? `${item.count}× ${item.name}` : item.name)).join(" + ")
      : `No ${remove.map((item) => item.name).join(" or ")}`,
    cost: after.cost + to.model.cost - before.cost - from.model.cost,
    blocked,
  };
}

/** How many of a model type a squad may have, a missing limit counting as no limit. */
function limitOf(model: ModelData): number {
  return model.max > 0 ? model.max : Number.POSITIVE_INFINITY;
}

/**
 * A model type's name without what it shares with another's: "Dominion w/
 * Special Weapon" next to "Dominion" is "Special Weapon"; "Celestian Sacresant
 * (Hallowed Mace)" next to "Celestian Sacresant (Anointed Halberd)" is "Hallowed Mace".
 */
export function apartFrom(name: string, other: string): string {
  const words = name.split(/\s+/);
  const theirs = other.split(/\s+/);
  let start = 0;
  while (start < words.length - 1 && looseWord(words[start]) === looseWord(theirs[start])) start++;
  const rest = words
    .slice(start)
    .join(" ")
    .replace(/^(?:w\/|with|and)\s+/i, "")
    .replace(/^\((.*)\)$/, "$1")
    .trim();
  // "w/ hand flamer" reads as a label once it starts with a capital.
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : name;
}

function looseWord(word: string | undefined): string {
  return (word ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
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
  if (!held) {
    out.push(base);
    model.slots.forEach((slot, index) => {
      for (const choice of slot.choices) {
        if (choice.name !== slot.default) out.push(loadoutWith(model, index, choice));
      }
    });
    return out;
  }
  // The loadouts its models hold now: each slot choice the totals show, the others at their defaults.
  model.slots.forEach((slot, index) => {
    for (const choice of slot.choices) {
      if (fits(held, choice.items) > 0) out.push(loadoutWith(model, index, choice));
    }
  });
  return out.length ? out : [base];
}

function defaultLoadout(model: ModelData): Loadout {
  return loadoutWith(model, -1);
}

/** Its fixed wargear, with `choice` in one slot and every other slot at its default. */
function loadoutWith(model: ModelData, slotIndex: number, choice?: ChoiceData): Loadout {
  const items: Counted[] = [...model.fixed];
  let cost = 0;
  model.slots.forEach((slot, index) => {
    const pick = index === slotIndex ? choice : slot.choices.find((c) => c.name === slot.default);
    if (!pick) return;
    items.push(...pick.items);
    cost += pick.cost;
  });
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
