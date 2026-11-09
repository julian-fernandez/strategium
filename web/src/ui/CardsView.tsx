import { useCallback, useState } from "react";
import type { Army } from "../../../shared/types";
import { Deck } from "../cards/Deck";
import { type Binding, buildDeck, type DeckOptions, type Squeeze } from "../cards/printOrder";
import { ReadableDeck } from "../cards/ReadableDeck";
import { READABLE_CARD_WIDTH, useWidth } from "./layout";

/** The least of a budget a rules page is held to, so a rule too long for any page can't split forever. */
const MIN_SQUEEZE = 0.4;

/** The options that are on or off; where to bind has three choices of its own. */
type Toggle = Exclude<keyof DeckOptions, "binding">;

const OPTIONS: { key: Toggle; label: string; hint: string }[] = [
  {
    key: "leadersOnBack",
    label: "Leaders on the back",
    hint: "A character's datasheet prints on the back of the unit it joins.",
  },
  {
    key: "duplex",
    label: "Double-sided",
    hint: "Every card gets a back, so each stays on its own sheet. Flip on the short edge.",
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

const BINDINGS: { value: Binding; label: string }[] = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "top", label: "Top" },
];

export function CardsView({
  army,
  numbers,
  options,
  onOptions,
  onPrint,
  fontsReady,
}: {
  army: Army;
  numbers: Map<string, number>;
  options: DeckOptions;
  onOptions: (options: DeckOptions) => void;
  onPrint: () => void;
  fontsReady: boolean;
}) {
  // A rules page that still spills at its smallest type is split again on a
  // smaller budget until every page fits. Measured afresh for each army, and
  // once the real fonts are in.
  const [squeezed, setSqueezed] = useState({ army, fontsReady, squeeze: {} as Squeeze });
  const onSpill = useCallback(
    (kind: keyof Squeeze) =>
      setSqueezed((previous) => {
        const current =
          previous.army === army && previous.fontsReady === fontsReady ? previous.squeeze : {};
        const share = Math.max(MIN_SQUEEZE, (current[kind] ?? 1) * 0.9);
        return share === current[kind]
          ? previous
          : { army, fontsReady, squeeze: { ...current, [kind]: share } };
      }),
    [army, fontsReady],
  );
  const squeeze =
    squeezed.army === army && squeezed.fontsReady === fontsReady ? squeezed.squeeze : {};
  const pages = buildDeck(army, options, squeeze);
  const sheets = options.duplex ? Math.ceil(pages.length / 2) : pages.length;
  const [area, width] = useWidth<HTMLDivElement>();
  // On a phone the A5 cards would be too small to read, so they're reflowed instead.
  const readable = width > 0 && width < READABLE_CARD_WIDTH;
  // Double-sided means nothing on a phone; it stays in place, greyed out.
  // Neither does a binding margin: the reflowed cards aren't pages.
  const unavailable = (key: keyof DeckOptions): boolean =>
    readable && (key === "duplex" || key === "binding");
  // Bound at the top, a double-sided sheet turns over its long edge.
  const hintFor = (option: (typeof OPTIONS)[number]): string =>
    option.key === "duplex" && options.binding === "top"
      ? "Every card gets a back, so each stays on its own sheet. Flip on the long edge, for a top binding."
      : option.hint;

  return (
    <div ref={area} className="flex flex-col gap-6 md:gap-8">
      <div className="no-print grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-stretch">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={unavailable(option.key)}
            onClick={() => onOptions({ ...options, [option.key]: !options[option.key] })}
            className="flex min-w-0 items-start gap-3 bg-panel p-3 text-left hairline transition duration-150 enabled:hover:border-line-strong disabled:cursor-default disabled:opacity-45 md:min-w-[220px] md:flex-1 md:p-4"
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
                {hintFor(option)}
              </span>
            </span>
          </button>
        ))}
        <div
          className={`flex min-w-0 flex-col gap-2 bg-panel p-3 hairline md:min-w-[220px] md:flex-1 md:p-4 ${
            unavailable("binding") ? "opacity-45" : ""
          }`}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] md:text-[13px] md:tracking-[0.16em]">
            Binding margin
          </span>
          <fieldset className="flex gap-1" aria-label="Binding margin">
            {BINDINGS.map((choice) => (
              <button
                key={choice.value}
                type="button"
                disabled={unavailable("binding")}
                onClick={() => onOptions({ ...options, binding: choice.value })}
                aria-pressed={options.binding === choice.value}
                className={`flex-1 border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition duration-150 disabled:cursor-default ${
                  options.binding === choice.value
                    ? "border-ink bg-ink text-ground"
                    : "border-line-strong text-ink-dim enabled:hover:text-ink"
                }`}
              >
                {choice.label}
              </button>
            ))}
          </fieldset>
          <span className="hidden text-[12px] leading-relaxed text-ink-dim md:block">
            Moves each card 5 mm away from one edge, at full size, for a spiral or rings.
          </span>
        </div>
        {readable ? null : (
          <div className="flex w-[180px] flex-col justify-center bg-panel-strong px-4 py-3 hairline">
            <span className="micro">{"// "}Paper</span>
            <span className="mt-1 text-[22px] font-extrabold leading-none">{sheets}</span>
            <span className="mt-1 text-[12px] text-ink-dim">
              A5 {sheets === 1 ? "sheet" : "sheets"} · {pages.length} pages
            </span>
            {/* The top bar's Print button is only on wide screens. */}
            <button type="button" className="btn btn-action mt-3 lg:hidden" onClick={onPrint}>
              Print
            </button>
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
          binding={options.binding}
          fontsReady={fontsReady}
          onSpill={onSpill}
        />
      )}
    </div>
  );
}
