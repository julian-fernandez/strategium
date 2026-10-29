import { useState } from "react";
import type { Army } from "../../../shared/types";
import { FitToWidth } from "../ui/FitToWidth";
import { ArmyRulesCard } from "./ArmyRulesCard";
import { DatasheetCard } from "./DatasheetCard";
import { GlossaryCard } from "./GlossaryCard";
import { FlipIcon } from "./Glyphs";
import type { DeckPage } from "./printOrder";
import { StratagemCard } from "./StratagemCard";
import { type CardTheme, themeFor } from "./themes";
import { UnitBackCard } from "./UnitBackCard";

/**
 * A5 landscape pages, as they print. Double-sided, each sheet shows one face
 * at a time on screen with a control to turn it over, so the deck scrolls at
 * half the length; printing still sends every page, fronts and backs in order.
 */
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
  const faces = { army, numbers, theme, fontsReady };
  const sheets: { front: DeckPage; back?: DeckPage }[] = [];
  for (let i = 0; i < pages.length; i += duplex ? 2 : 1) {
    const front = pages[i];
    if (front) sheets.push({ front, back: duplex ? pages[i + 1] : undefined });
  }

  return (
    <div className="flex flex-col items-center gap-8 print:gap-0">
      {sheets.map((sheet, index) => (
        <Sheet key={sheet.front.key} number={index + 1} {...sheet} {...faces} />
      ))}
    </div>
  );
}

type Faces = { army: Army; numbers: Map<string, number>; theme: CardTheme; fontsReady: boolean };

/**
 * One sheet of paper: its front, and its back behind it. Both stay laid out
 * (the hidden one is only invisible) so text fitting can measure them and
 * both print.
 */
function Sheet({
  number,
  front,
  back,
  ...faces
}: { number: number; front: DeckPage; back?: DeckPage } & Faces) {
  const [flipped, setFlipped] = useState(false);
  const shown = flipped && back ? back : front;

  return (
    <section className="flex w-full flex-col gap-2 print:gap-0">
      <div className="print-page-label mx-auto flex w-full max-w-[210mm] items-center justify-between gap-4">
        <p className="micro">
          {"// "}
          {back ? `Sheet ${number} · ${flipped ? "back" : "front"}` : `Page ${number}`}
          {shown.kind === "blank" ? " · blank" : ""}
        </p>
        {back ? (
          <button
            type="button"
            onClick={() => setFlipped(!flipped)}
            aria-pressed={flipped}
            aria-label={
              flipped ? `Show the front of sheet ${number}` : `Show the back of sheet ${number}`
            }
            className="flex h-8 items-center gap-2 border border-line px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-dim transition-colors duration-150 hover:border-line-strong hover:text-ink"
          >
            <FlipIcon className="h-3.5 w-3.5" />
            {flipped ? "Front" : "Back"}
          </button>
        ) : null}
      </div>
      <FitToWidth>
        <div className="grid print:block">
          <Face page={front} visible={!flipped || !back} {...faces} />
          {back ? <Face page={back} visible={flipped} {...faces} /> : null}
        </div>
      </FitToWidth>
    </section>
  );
}

/** One printed page. Both faces of a sheet share a grid cell; the one not shown is invisible. */
function Face({
  page,
  visible,
  army,
  numbers,
  theme,
  fontsReady,
}: { page: DeckPage; visible: boolean } & Faces) {
  return (
    <div
      aria-hidden={!visible}
      className={`print-page col-start-1 row-start-1 flex h-[148mm] w-[210mm] items-center justify-center transition-opacity duration-150 print:visible print:opacity-100 ${
        visible ? "opacity-100" : "pointer-events-none invisible opacity-0"
      } ${page.kind === "blank" ? "outline outline-1 outline-dashed outline-line" : "bg-white/5"}`}
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
  );
}
