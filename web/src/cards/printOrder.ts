import type { Army, AttachedGroup, Datasheet, Stratagem } from "../../../shared/types";

export type DeckOptions = {
  /** Print leaders and supports on the back of the unit they join. */
  leadersOnBack: boolean;
  /**
   * Print double-sided: every card gets a back, so each stays on its own sheet.
   * A unit without a leader gets its own stratagems there.
   */
  duplex: boolean;
  stratagems: boolean;
  /** "Paragon Warsuits #1, #2, #3" for units that share a name. */
  numberDuplicates: boolean;
};

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  leadersOnBack: true,
  duplex: true,
  stratagems: true,
  numberDuplicates: true,
};

export type DeckPage =
  | { kind: "datasheet"; key: string; unit: Datasheet }
  | {
      kind: "back";
      key: string;
      bodyguard: Datasheet;
      characters: Datasheet[];
      stratagems: Stratagem[];
    }
  | { kind: "unit-back"; key: string; unit: Datasheet; stratagems: Stratagem[] }
  | { kind: "stratagems"; key: string; stratagems: Stratagem[] }
  | { kind: "blank"; key: string };

const STRATAGEMS_PER_PAGE = 4;

/**
 * The print order: each datasheet followed by its back, then the stratagem deck.
 * A back holds the unit's leaders, or (double-sided only) the unit's own
 * stratagems, or is left blank when there's nothing to put on it.
 */
export function buildDeck(army: Army, options: DeckOptions): DeckPage[] {
  const pages: DeckPage[] = [];
  const byId = new Map(army.units.map((unit) => [unit.id, unit]));
  const groupFor = (unit: Datasheet): AttachedGroup | undefined =>
    army.groups.find((group) => group.bodyguardId === unit.id && group.characterIds.length > 0);
  const onBack = new Set(
    options.leadersOnBack
      ? army.groups.filter((g) => g.bodyguardId).flatMap((g) => g.characterIds)
      : [],
  );

  const pushBlank = (key: string) => {
    if (options.duplex) pages.push({ kind: "blank", key: `blank-${key}` });
  };

  for (const unit of army.units) {
    if (onBack.has(unit.id)) continue;
    pages.push({ kind: "datasheet", key: unit.id, unit });

    const group = options.leadersOnBack ? groupFor(unit) : undefined;
    if (group) {
      const characters = group.characterIds
        .map((id) => byId.get(id))
        .filter((c): c is Datasheet => Boolean(c));
      const stratagems = army.stratagems.filter((s) => group.stratagemIds.includes(s.id));
      pages.push({ kind: "back", key: `back-${unit.id}`, bodyguard: unit, characters, stratagems });
      continue;
    }

    const own = army.stratagems.filter((s) => s.usableBy.includes(unit.name));
    if (options.duplex && own.length) {
      pages.push({ kind: "unit-back", key: `unit-back-${unit.id}`, unit, stratagems: own });
    } else {
      pushBlank(unit.id);
    }
  }

  if (options.stratagems) {
    for (let i = 0; i < army.stratagems.length; i += STRATAGEMS_PER_PAGE) {
      const key = `stratagems-${i}`;
      pages.push({
        kind: "stratagems",
        key,
        stratagems: army.stratagems.slice(i, i + STRATAGEMS_PER_PAGE),
      });
      pushBlank(key);
    }
  }

  return pages;
}
