import type { Army } from "../../../shared/types";
import { FitToWidth } from "../ui/FitToWidth";
import { ArmyRulesCard } from "./ArmyRulesCard";
import { DatasheetCard } from "./DatasheetCard";
import { GlossaryCard } from "./GlossaryCard";
import type { DeckPage } from "./printOrder";
import { StratagemCard } from "./StratagemCard";
import { themeFor } from "./themes";
import { UnitBackCard } from "./UnitBackCard";

/** A5 landscape pages, as they print. On screen each page gets a small label. */
export function Deck({
  army,
  pages,
  numbers,
  duplex,
  fontsReady,
}: {
  army: Army;
  pages: DeckPage[];
  numbers: Map<string, number>;
  /** Double-sided: every second page is the back of the one before. */
  duplex: boolean;
  fontsReady: boolean;
}) {
  const theme = themeFor(army.faction);

  return (
    <div className="flex flex-col items-center gap-8 print:gap-0">
      {pages.map((page, index) => (
        <section key={page.key} className="flex w-full flex-col gap-2 print:gap-0">
          <p className="print-page-label micro">
            {"// "}Page {index + 1}
            {duplex && index % 2 === 1 ? ` · back of page ${index}` : ""}
            {page.kind === "blank" ? " · blank back" : ""}
          </p>
          <FitToWidth>
            <div
              className={`print-page flex h-[148mm] w-[210mm] items-center justify-center ${
                page.kind === "blank"
                  ? "outline outline-1 outline-dashed outline-line"
                  : "bg-white/5"
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
              {page.kind === "unit-back" ? (
                <UnitBackCard
                  unit={page.unit}
                  characters={page.characters}
                  number={numbers.get(page.unit.id)}
                  stratagems={page.stratagems}
                  theme={theme}
                  fontsReady={fontsReady}
                />
              ) : null}
              {page.kind === "army-rules" ? (
                <ArmyRulesCard
                  army={army}
                  sections={page.sections}
                  part={page.part}
                  parts={page.parts}
                  theme={theme}
                  fontsReady={fontsReady}
                />
              ) : null}
              {page.kind === "glossary" ? (
                <GlossaryCard
                  army={army}
                  rules={page.rules}
                  part={page.part}
                  parts={page.parts}
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
          </FitToWidth>
        </section>
      ))}
    </div>
  );
}
