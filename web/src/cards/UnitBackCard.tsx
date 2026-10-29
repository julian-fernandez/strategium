import type { Datasheet, Stratagem } from "../../../shared/types";
import { CardShell, UnitNumber } from "./DatasheetCard";
import { Emblem } from "./Glyphs";
import { StratagemList } from "./StratagemList";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

/**
 * Stratagems for one unit, with the whole card for them so each row also says
 * when it's played: a lone unit's back, or, after an attached unit and its
 * characters' datasheets, the stratagems the attached unit as a whole can use.
 */
export function UnitBackCard({
  unit,
  characters = [],
  number,
  stratagems,
  theme,
  fontsReady,
}: {
  unit: Datasheet;
  /** The characters attached to the unit, when the card is for all of them. */
  characters?: Datasheet[];
  number?: number;
  stratagems: Stratagem[];
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const body = useFitText<HTMLDivElement>(7.2, 5, stratagems, fontsReady);
  const members = [unit, ...characters];
  const keywords = [...new Set(members.flatMap((member) => member.keywords))];
  const factionKeywords = [...new Set(members.flatMap((member) => member.factionKeywords))];
  const points = members.reduce((sum, member) => sum + member.points, 0);

  return (
    <CardShell
      theme={theme}
      keywords={keywords}
      factionKeywords={factionKeywords}
      header={
        <div className="relative z-10 flex w-full items-center gap-[5mm] px-[4mm]">
          <div className="min-w-0 flex-1">
            <p className="font-condensed text-[7pt] font-bold uppercase tracking-[0.18em] text-white/75">
              {characters.length
                ? `Stratagems for the attached unit · ${points} points`
                : `${unit.modelCount} ${unit.modelCount === 1 ? "model" : "models"} · ${unit.points} points`}
            </p>
            <h2 className="font-condensed text-[17pt] font-extrabold uppercase leading-none">
              {unit.name}
              {number ? <UnitNumber value={number} /> : null}
            </h2>
            {characters.length ? (
              <p className="mt-[1.2mm] font-condensed text-[8pt] font-bold uppercase tracking-[0.08em] text-white/85">
                {characters.map((character) => character.name).join(" + ")}
              </p>
            ) : null}
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
