import type { Stratagem } from "../../../shared/types";
import { SectionBar } from "./parts";
import { phaseNumeral } from "./StratagemCard";

/**
 * "Stratagems for this unit" on the back of a card: phase numeral, name and CP
 * in two columns. With `showWhen`, each row also says when it's played, for
 * backs that have the room (a unit without a leader has the whole card).
 */
export function StratagemList({
  stratagems,
  showWhen = false,
}: {
  stratagems: Stratagem[];
  showWhen?: boolean;
}) {
  return (
    <div>
      <SectionBar title={`Stratagems for this unit · ${stratagems.length}`} />
      <ul className="grid grid-cols-2 gap-x-[3mm] px-[1.6mm] pb-[1mm]">
        {stratagems.map((stratagem) => (
          <li key={stratagem.id} className={showWhen ? "mt-[1.4mm]" : "mt-[0.6mm]"}>
            <div className="flex items-baseline gap-[1.2mm]">
              <span className="w-[2.2em] shrink-0 font-condensed font-bold text-[#6a6a62]">
                {phaseNumeral(stratagem.phase)}
              </span>
              <span className="flex-1 font-semibold uppercase leading-tight">{stratagem.name}</span>
              <span className="font-condensed font-bold text-[var(--accent)]">
                {stratagem.cp}CP
              </span>
            </div>
            {showWhen ? (
              <p className="pl-[calc(2.2em+1.2mm)] text-[0.92em] leading-snug text-[#4a4a44]">
                {stratagem.when}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
