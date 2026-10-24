import type { Army } from "../../../shared/types";
import { DatasheetCard } from "./DatasheetCard";
import { LeaderBackCard } from "./LeaderBackCard";
import type { DeckPage } from "./printOrder";
import { StratagemCard } from "./StratagemCard";
import { themeFor } from "./themes";
import { UnitBackCard } from "./UnitBackCard";

/** A5 landscape pages, as they print. On screen each page gets a small label. */
export function Deck({
  army,
  pages,
  numbers,
  fontsReady,
}: {
  army: Army;
  pages: DeckPage[];
  numbers: Map<string, number>;
  fontsReady: boolean;
}) {
  const theme = themeFor(army.faction);

  return (
    <div className="flex flex-col items-center gap-8 print:gap-0">
      {pages.map((page, index) => (
        <section key={page.key} className="flex flex-col items-start gap-2 print:gap-0">
          <p className="print-page-label micro">
            {"// "}Page {index + 1}
            {page.kind === "back" || page.kind === "unit-back" ? ` · back of page ${index}` : ""}
            {page.kind === "blank" ? " · blank back" : ""}
          </p>
          <div
            className={`print-page flex h-[148mm] w-[210mm] items-center justify-center ${
              page.kind === "blank" ? "outline outline-1 outline-dashed outline-line" : "bg-white/5"
            }`}
          >
            {page.kind === "datasheet" ? (
              <DatasheetCard
                sheet={page.unit}
                number={numbers.get(page.unit.id)}
                theme={theme}
                fontsReady={fontsReady}
              />
            ) : null}
            {page.kind === "back" ? (
              <LeaderBackCard
                bodyguard={page.bodyguard}
                characters={page.characters}
                stratagems={page.stratagems}
                numbers={numbers}
                theme={theme}
                fontsReady={fontsReady}
              />
            ) : null}
            {page.kind === "unit-back" ? (
              <UnitBackCard
                unit={page.unit}
                number={numbers.get(page.unit.id)}
                stratagems={page.stratagems}
                theme={theme}
                fontsReady={fontsReady}
              />
            ) : null}
            {page.kind === "stratagems" ? (
              <div className="grid grid-cols-2 gap-[5mm]">
                {page.stratagems.map((stratagem) => (
                  <StratagemCard
                    key={stratagem.id}
                    stratagem={stratagem}
                    theme={theme}
                    fontsReady={fontsReady}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
