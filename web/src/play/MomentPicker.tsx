import { useStored } from "../ui/useStored";
import { PHASES, type Phase, TURNS, type Turn } from "./playOrder";

export type Moment = { phase: Phase; turn: Turn };

/** The phase and whose turn it is: one setting for Play and Stratagems, remembered across reloads. */
export function useMoment(): [Moment, (moment: Moment) => void] {
  return useStored<Moment>("army-cards:play", { phase: "all", turn: "mine" });
}

/** "Shooting · My turn", for a collapsed filter. */
export function momentLabel({ phase, turn }: Moment): string {
  const phaseLabel = PHASES.find((p) => p.id === phase)?.label ?? "All";
  const turnLabel = TURNS.find((t) => t.id === turn)?.label ?? "";
  return `${phase === "all" ? "Any phase" : phaseLabel} · ${turn === "both" ? "Either turn" : turnLabel}`;
}

/** The phase bar and the turn switch. */
export function MomentPicker({
  moment,
  onMoment,
}: {
  moment: Moment;
  onMoment: (moment: Moment) => void;
}) {
  const { phase, turn } = moment;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-6 gap-1" role="tablist" aria-label="Phase">
        {PHASES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={phase === item.id}
            onClick={() => onMoment({ phase: item.id, turn })}
            className={`flex min-w-0 flex-col items-center border px-1 py-1.5 transition-colors duration-150 ${
              phase === item.id
                ? "border-ink bg-ink text-ground-deep"
                : "border-line text-ink-dim hover:border-line-strong"
            }`}
          >
            <span className="text-[15px] font-extrabold leading-none">{item.numeral}</span>
            <span className="mt-1 w-full text-center text-[8px] font-semibold uppercase tracking-[0.08em] sm:text-[9px] sm:tracking-[0.14em]">
              <span className="sm:hidden">{item.short ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </span>
          </button>
        ))}
      </div>
      <fieldset className="grid grid-cols-3 gap-1 border-0 p-0" aria-label="Whose turn">
        {TURNS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={turn === item.id}
            onClick={() => onMoment({ phase, turn: item.id })}
            className={`border py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-150 ${
              turn === item.id
                ? "border-faction bg-faction text-ink"
                : "border-line text-ink-dim hover:border-line-strong"
            }`}
          >
            {item.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
