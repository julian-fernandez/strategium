import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Army } from "../../../shared/types";
import { Deck } from "../cards/Deck";
import {
  type Binding,
  buildDeck,
  type DeckOptions,
  impose,
  type LeaderPlacement,
  type Paper,
  type Squeeze,
} from "../cards/printOrder";
import { ReadableDeck } from "../cards/ReadableDeck";
import { CoverPanel } from "./CoverPanel";
import { READABLE_CARD_WIDTH, useWidth } from "./layout";
import { useCover } from "./useCover";

/** The least of a budget a rules page is held to, so a rule too long for any page can't split forever. */
const MIN_SQUEEZE = 0.4;
/** The most pages a unit's wargear may add for spilling, so it can't grow forever either. */
const MAX_EXTRA_WARGEAR = 4;

/** The options that are on or off; the rest are a choice of a few. */
type Toggle = Exclude<keyof DeckOptions, "binding" | "leaders" | "paper">;

const OPTIONS: { key: Toggle; label: string; hint: string }[] = [
  {
    key: "duplex",
    label: "Double-sided",
    hint: "Every card gets a back, so each stays on its own sheet.",
  },
  {
    key: "stratagems",
    label: "Stratagem deck",
    hint: "Four stratagem cards per page, after the datasheets.",
  },
  {
    key: "fullDatasheets",
    label: "Full datasheets",
    hint: "After each unit's card, a wargear page: every other weapon it could take, and its wargear options.",
  },
  {
    key: "cover",
    label: "Cover",
    hint: "A first page with the faction, and the list's name, a message and an image if you like. The army rules print on its back.",
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

const LEADERS: { value: LeaderPlacement; label: string; hint: string }[] = [
  {
    value: "own",
    label: "Own card",
    hint: "Each character prints on its own card, in list order.",
  },
  {
    value: "back",
    label: "On the back",
    hint: "A character prints on the back of the unit it joins.",
  },
  {
    value: "facing",
    label: "Facing",
    hint: "Double-sided, a unit prints on a back and its leader on the next front, so an open booklet shows both.",
  },
];

const BINDINGS: { value: Binding; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "" },
  { value: "left", label: "Left", hint: "" },
  { value: "top", label: "Top", hint: "" },
];

const PAPERS: { value: Paper; label: string; hint: string }[] = [
  { value: "a5", label: "A5", hint: "One card to each A5 sheet." },
  {
    value: "a4",
    label: "A4 ×2",
    hint: "Two A5 cards to each A4 sheet, one above the other, to cut in half.",
  },
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
  // smaller budget until every page fits. Measured afresh for each army, once
  // the real fonts are in, and for each binding (a padded edge leaves less room).
  const binding = options.binding;
  const [squeezed, setSqueezed] = useState({ army, fontsReady, binding, squeeze: {} as Squeeze });
  const onSpill = useCallback(
    (kind: keyof Squeeze) =>
      setSqueezed((previous) => {
        const current =
          previous.army === army &&
          previous.fontsReady === fontsReady &&
          previous.binding === binding
            ? previous.squeeze
            : {};
        const share = Math.max(MIN_SQUEEZE, (current[kind] ?? 1) * 0.9);
        return share === current[kind]
          ? previous
          : { army, fontsReady, binding, squeeze: { ...current, [kind]: share } };
      }),
    [army, fontsReady, binding],
  );
  const squeeze =
    squeezed.army === army && squeezed.fontsReady === fontsReady && squeezed.binding === binding
      ? squeezed.squeeze
      : {};
  // The same for a unit's wargear on full datasheets: one that still spills gets another
  // page, up to a few. Counted per unit, afresh as above.
  const [extra, setExtra] = useState({
    army,
    fontsReady,
    binding,
    pages: {} as Record<string, number>,
  });
  const onWargearSpill = useCallback(
    (unitId: string) =>
      setExtra((previous) => {
        const current =
          previous.army === army &&
          previous.fontsReady === fontsReady &&
          previous.binding === binding
            ? previous.pages
            : {};
        const pages = Math.min(MAX_EXTRA_WARGEAR, (current[unitId] ?? 0) + 1);
        return pages === current[unitId]
          ? previous
          : { army, fontsReady, binding, pages: { ...current, [unitId]: pages } };
      }),
    [army, fontsReady, binding],
  );
  const wargearExtra =
    extra.army === army && extra.fontsReady === fontsReady && extra.binding === binding
      ? extra.pages
      : {};
  const pages = buildDeck(army, options, squeeze, wargearExtra);
  const sheets = impose(pages, options).length;
  const cover = useCover(army);
  const [area, width] = useWidth<HTMLDivElement>();
  // On a phone the A5 cards would be too small to read, so they're reflowed on screen.
  // They still print as A5 pages, so every option applies there too.
  const readable = width > 0 && width < READABLE_CARD_WIDTH;

  // A phone shows the reflowed cards, so printing lays out the A5 deck off screen first,
  // all at once, then prints it. Printing from the browser's own menu gets it too.
  const [printing, setPrinting] = useState<false | "now" | "browser">(false);
  const print = () => (readable ? setPrinting("now") : onPrint());
  useEffect(() => {
    if (!printing) return;
    const frame =
      printing === "now"
        ? requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
        : 0;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);
  useEffect(() => {
    if (!readable) return;
    const before = () => flushSync(() => setPrinting((now) => now || "browser"));
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, [readable]);

  // Double-sided, a sheet turns over the edge the cards are bound along: the short edge
  // of A5 landscape and the long edge of A4 portrait are the same, upright one.
  const upright = options.paper === "a4" ? "long" : "short";
  const across = options.paper === "a4" ? "short" : "long";
  const hintFor = (option: (typeof OPTIONS)[number]): string =>
    option.key !== "duplex"
      ? option.hint
      : options.binding === "top"
        ? `${option.hint} Flip on the ${across} edge, for a top binding.`
        : `${option.hint} Flip on the ${upright} edge.`;

  const deck = {
    army,
    pages,
    numbers,
    duplex: options.duplex,
    binding: options.binding,
    paper: options.paper,
    cover,
    fontsReady,
    onSpill,
    onWargearSpill,
  };

  return (
    <div ref={area} className="flex flex-col gap-6 md:gap-8">
      <div className="no-print grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-stretch">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onOptions({ ...options, [option.key]: !options[option.key] })}
            className="flex min-w-0 items-start gap-3 bg-panel p-3 text-left hairline transition duration-150 enabled:hover:border-line-strong md:min-w-[220px] md:flex-1 md:p-4"
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
        <ChoiceTile
          label="Leaders"
          choices={LEADERS}
          value={options.leaders}
          onChoose={(leaders) => onOptions({ ...options, leaders })}
          // Facing pages only exist double-sided; single-sided, a leader follows its unit.
          unavailable={(value) =>
            value === "facing" && !options.duplex ? "Needs double-sided printing." : undefined
          }
        />
        <ChoiceTile
          label="Binding margin"
          choices={BINDINGS}
          value={options.binding}
          onChoose={(choice) => onOptions({ ...options, binding: choice })}
          hint="Pads each card along one edge, at the same size and place, for a spiral or rings."
        />
        <ChoiceTile
          label="Paper"
          choices={PAPERS}
          value={options.paper}
          onChoose={(paper) => onOptions({ ...options, paper })}
        />
        <div className="col-span-2 flex flex-col justify-center bg-panel-strong px-4 py-3 hairline md:w-[180px]">
          <span className="micro">{"// "}Paper</span>
          <span className="mt-1 text-[22px] font-extrabold leading-none">{sheets}</span>
          <span className="mt-1 text-[12px] text-ink-dim">
            {options.paper === "a4" ? "A4" : "A5"} {sheets === 1 ? "sheet" : "sheets"} ·{" "}
            {pages.length} pages
          </span>
          {/* The top bar's Print button is only on wide screens. */}
          <button
            type="button"
            className="btn btn-action mt-3 lg:hidden"
            onClick={print}
            disabled={Boolean(printing)}
          >
            {printing ? "Preparing…" : "Print"}
          </button>
        </div>
      </div>
      {options.cover ? <CoverPanel army={army} cover={cover} /> : null}
      {width === 0 ? null : readable ? (
        <>
          <div className="no-print">
            <ReadableDeck army={army} options={options} numbers={numbers} fontsReady={fontsReady} />
          </div>
          {printing ? (
            // Laid out where it can be measured but not seen, and printed in place of the screen.
            <div
              aria-hidden
              className="pointer-events-none fixed left-[-10000px] top-0 w-[210mm] print:static print:w-auto"
            >
              <Deck {...deck} eager />
            </div>
          ) : null}
        </>
      ) : (
        <Deck {...deck} />
      )}
    </div>
  );
}

/** A card option that's a choice of a few, shown as a row of buttons with a line on the one chosen. */
function ChoiceTile<T extends string>({
  label,
  choices,
  value,
  onChoose,
  hint,
  unavailable,
}: {
  label: string;
  choices: { value: T; label: string; hint: string }[];
  value: T;
  onChoose: (value: T) => void;
  /** The tile's own line; without one, the chosen button's. */
  hint?: string;
  /** Why a choice can't be made now, if it can't. */
  unavailable?: (value: T) => string | undefined;
}) {
  const chosen = choices.find((choice) => choice.value === value);
  const why = unavailable?.(value);
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-panel p-3 hairline md:min-w-[220px] md:flex-1 md:p-4">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] md:text-[13px] md:tracking-[0.16em]">
        {label}
      </span>
      <fieldset className="flex gap-1" aria-label={label}>
        {choices.map((choice) => {
          const blocked = unavailable?.(choice.value);
          return (
            <button
              key={choice.value}
              type="button"
              disabled={Boolean(blocked) && choice.value !== value}
              title={blocked}
              onClick={() => onChoose(choice.value)}
              aria-pressed={value === choice.value}
              className={`flex-1 border px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition duration-150 disabled:cursor-default disabled:opacity-45 ${
                value === choice.value
                  ? "border-ink bg-ink text-ground"
                  : "border-line-strong text-ink-dim enabled:hover:text-ink"
              }`}
            >
              {choice.label}
            </button>
          );
        })}
      </fieldset>
      <span className="hidden text-[12px] leading-relaxed text-ink-dim md:block">
        {why ?? hint ?? chosen?.hint}
      </span>
    </div>
  );
}
