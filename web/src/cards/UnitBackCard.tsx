import type { Datasheet, Stratagem } from "../../../shared/types";
import { CardShell, UnitNumber } from "./DatasheetCard";
import { Emblem } from "./Glyphs";
import { StratagemList } from "./StratagemList";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

/**
 * The back of a unit that has no leader: the same stratagem list as a leader
 * back, with the whole card for it, so each row also says when it's played.
 */
export function UnitBackCard({
  unit,
  number,
  stratagems,
  theme,
  fontsReady,
}: {
  unit: Datasheet;
  number?: number;
  stratagems: Stratagem[];
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const body = useFitText<HTMLDivElement>(7.2, 5, unit, fontsReady);

  return (
    <CardShell
      theme={theme}
      keywords={unit.keywords}
      factionKeywords={unit.factionKeywords}
      header={
        <div className="relative z-10 flex w-full items-center gap-[5mm] px-[4mm]">
          <div className="min-w-0 flex-1">
            <p className="font-condensed text-[7pt] font-bold uppercase tracking-[0.18em] text-white/75">
              {unit.modelCount} {unit.modelCount === 1 ? "model" : "models"} · {unit.points} points
            </p>
            <h2 className="font-condensed text-[17pt] font-extrabold uppercase leading-none">
              {unit.name}
              {number ? <UnitNumber value={number} /> : null}
            </h2>
          </div>
          <Emblem className="h-[24mm] w-[24mm] shrink-0 text-white/25" />
        </div>
      }
    >
      <div
        ref={body}
        className="min-h-0 flex-1 overflow-hidden p-[2.5mm]"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        <StratagemList stratagems={stratagems} showWhen />
      </div>
    </CardShell>
  );
}
