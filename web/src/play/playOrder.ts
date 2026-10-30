import type { Army, Datasheet, Stratagem } from "../../../shared/types";

export type Phase = "all" | "command" | "movement" | "shooting" | "charge" | "fight";
export type Turn = "mine" | "theirs" | "both";

export const TURNS: { id: Turn; label: string }[] = [
  { id: "mine", label: "My turn" },
  { id: "theirs", label: "Their turn" },
  { id: "both", label: "Both" },
];

/** `short` is for a phone's phase bar, where "Movement" doesn't fit. */
export const PHASES: { id: Phase; numeral: string; label: string; short?: string }[] = [
  { id: "all", numeral: "∗", label: "All" },
  { id: "command", numeral: "I", label: "Command" },
  { id: "movement", numeral: "II", label: "Movement", short: "Move" },
  { id: "shooting", numeral: "III", label: "Shooting" },
  { id: "charge", numeral: "IV", label: "Charge" },
  { id: "fight", numeral: "V", label: "Fight" },
];

/** One page of play mode: a unit, with any characters leading it. */
export type PlayEntry = {
  key: string;
  unit: Datasheet;
  characters: Datasheet[];
  stratagems: Stratagem[];
};

/**
 * The units to page through during a game, in list order. Characters attached
 * to a bodyguard ride along with it, as they do on the table.
 */
export function playEntries(army: Army): PlayEntry[] {
  const byId = new Map(army.units.map((unit) => [unit.id, unit]));
  const led = army.groups.filter((group) => group.bodyguardId && group.characterIds.length);
  const folded = new Set(led.flatMap((group) => group.characterIds));
  const armyWide = army.stratagems.filter((s) => s.usableBy.length === 0);

  return army.units
    .filter((unit) => !folded.has(unit.id))
    .map((unit) => {
      const group = led.find((g) => g.bodyguardId === unit.id);
      const characters = (group?.characterIds ?? [])
        .map((id) => byId.get(id))
        .filter((c): c is Datasheet => Boolean(c));
      const own = group
        ? army.stratagems.filter((s) => group.stratagemIds.includes(s.id))
        : army.stratagems.filter((s) => s.usableBy.includes(unit.name));
      return { key: unit.id, unit, characters, stratagems: [...own, ...armyWide] };
    });
}

/** The entry a unit is on: its own, or the one of the unit it leads. */
export function entryFor(entries: PlayEntry[], unitId: string): PlayEntry | undefined {
  return entries.find(
    (entry) => entry.unit.id === unitId || entry.characters.some((c) => c.id === unitId),
  );
}

/**
 * Whether a stratagem can be used in this phase and turn. "Any phase"
 * stratagems fit every phase; ones with no turn, or either player's turn, fit both.
 */
export function usableNow(stratagem: Stratagem, phase: Phase, turn: Turn): boolean {
  const phaseText = stratagem.phase.toLowerCase();
  const turnText = stratagem.turn.toLowerCase();
  const phaseOk = phase === "all" || phaseText.includes(phase) || phaseText.includes("any");
  const turnOk =
    turn === "both" ||
    turnText === "" ||
    turnText.includes("either") ||
    (turn === "mine" ? turnText.includes("your") : turnText.includes("opponent"));
  return phaseOk && turnOk;
}
