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
      {/* Two rows of three on a phone, so each name reads at full size; one row of six wider. */}
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-6" role="tablist" aria-label="Phase">
        {PHASES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={phase === item.id}
            onClick={() => onMoment({ phase: item.id, turn })}
            className={`flex min-w-0 items-center justify-center gap-1.5 border px-1 py-2 transition-colors duration-150 sm:flex-col sm:gap-1 sm:py-1.5 ${
              phase === item.id
                ? "border-ink bg-ink text-ground-deep"
                : "border-line text-ink-dim hover:border-line-strong"
            }`}
          >
            <span className="text-[14px] font-extrabold leading-none sm:text-[15px]">
              {item.numeral}
            </span>
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] sm:w-full sm:text-center sm:text-[9px] sm:tracking-[0.14em]">
              {item.label}
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
