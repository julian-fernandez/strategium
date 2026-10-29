import type { Army } from "../../../shared/types";
import { Deck } from "../cards/Deck";
import { buildDeck, type DeckOptions } from "../cards/printOrder";
import { ReadableDeck } from "../cards/ReadableDeck";
import { READABLE_CARD_WIDTH, useWidth } from "./layout";

const OPTIONS: { key: keyof DeckOptions; label: string; hint: string }[] = [
  {
    key: "leadersOnBack",
    label: "Leaders on the back",
    hint: "A character's datasheet prints on the back of the unit it joins, then the attached unit's stratagems.",
  },
  {
    key: "duplex",
    label: "Double-sided",
    hint: "Every card gets a back; units without a leader list their stratagems there. Flip on the short edge.",
  },
  {
    key: "stratagems",
    label: "Stratagem deck",
    hint: "Four stratagem cards per page, after the datasheets.",
  },
  {
    key: "armyRules",
    label: "Army rules card",
    hint: "The army rule, detachment rules and enhancements taken, on the first card.",
  },
  {
    key: "glossary",
    label: "Rules reference",
    hint: "Every core ability and weapon keyword the cards name, in full, at the end.",
  },
  {
    key: "numberDuplicates",
    label: "Number repeats",
    hint: "Units that share a name become #1, #2, #3, easy to call out mid-game.",
  },
];

export function CardsView({
  army,
  numbers,
  options,
  onOptions,
  fontsReady,
}: {
  army: Army;
  numbers: Map<string, number>;
  options: DeckOptions;
  onOptions: (options: DeckOptions) => void;
  fontsReady: boolean;
}) {
  const pages = buildDeck(army, options);
  const sheets = options.duplex ? Math.ceil(pages.length / 2) : pages.length;
  const [area, width] = useWidth<HTMLDivElement>();
  // On a phone the A5 cards would be too small to read, so they're reflowed instead.
  const readable = width > 0 && width < READABLE_CARD_WIDTH;
  const shown = readable ? OPTIONS.filter((option) => option.key !== "duplex") : OPTIONS;

  return (
    <div ref={area} className="flex flex-col gap-6 md:gap-8">
      <div className="no-print grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-stretch">
        {shown.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onOptions({ ...options, [option.key]: !options[option.key] })}
            className="flex min-w-0 items-start gap-3 bg-panel p-3 text-left hairline transition-colors duration-150 hover:border-line-strong md:min-w-[220px] md:flex-1 md:p-4"
            aria-pressed={options[option.key]}
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-line-strong">
              {options[option.key] ? <span className="h-2 w-2 bg-ink" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] md:text-[13px] md:tracking-[0.16em]">
                {option.label}
              </span>
              <span className="mt-1 hidden text-[12px] leading-relaxed text-ink-dim md:block">
                {option.hint}
              </span>
            </span>
          </button>
        ))}
        {readable ? null : (
          <div className="flex w-[180px] flex-col justify-center bg-panel-strong px-4 hairline">
            <span className="micro">{"// "}Paper</span>
            <span className="mt-1 text-[22px] font-extrabold leading-none">{sheets}</span>
            <span className="mt-1 text-[12px] text-ink-dim">
              A5 {sheets === 1 ? "sheet" : "sheets"} · {pages.length} pages
            </span>
          </div>
        )}
      </div>
      {width === 0 ? null : readable ? (
        <ReadableDeck army={army} options={options} numbers={numbers} fontsReady={fontsReady} />
      ) : (
        <Deck
          army={army}
          pages={pages}
          numbers={numbers}
          duplex={options.duplex}
          fontsReady={fontsReady}
        />
      )}
    </div>
  );
}
