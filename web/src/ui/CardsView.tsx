import type { Army } from "../../../shared/types";
import { Deck } from "../cards/Deck";
import { buildDeck, type DeckOptions } from "../cards/printOrder";

const OPTIONS: { key: keyof DeckOptions; label: string; hint: string }[] = [
  {
    key: "leadersOnBack",
    label: "Leaders on the back",
    hint: "Characters print on the back of the unit they join, with that unit's stratagems.",
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

  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex flex-wrap items-stretch gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onOptions({ ...options, [option.key]: !options[option.key] })}
            className="flex min-w-[220px] flex-1 items-start gap-3 bg-panel p-4 text-left hairline transition-colors duration-150 hover:border-line-strong"
            aria-pressed={options[option.key]}
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-line-strong">
              {options[option.key] ? <span className="h-2 w-2 bg-ink" /> : null}
            </span>
            <span>
              <span className="block text-[13px] font-semibold uppercase tracking-[0.16em]">
                {option.label}
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-ink-dim">
                {option.hint}
              </span>
            </span>
          </button>
        ))}
        <div className="flex w-[180px] flex-col justify-center bg-panel-strong px-4 hairline">
          <span className="micro">{"// "}Paper</span>
          <span className="mt-1 text-[22px] font-extrabold leading-none">{sheets}</span>
          <span className="mt-1 text-[12px] text-ink-dim">
            A5 {sheets === 1 ? "sheet" : "sheets"} · {pages.length} pages
          </span>
        </div>
      </div>
      <Deck army={army} pages={pages} numbers={numbers} fontsReady={fontsReady} />
    </div>
  );
}
