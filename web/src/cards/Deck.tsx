import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Army } from "../../../shared/types";
import { FitToWidth } from "../ui/FitToWidth";
import type { Cover } from "../ui/useCover";
import { ArmyRulesCard } from "./ArmyRulesCard";
import { boundEdge, CardFrame, type Edges, type PadEdge } from "./bindingPad";
import { CoverCard } from "./CoverCard";
import { DatasheetCard, WargearCard } from "./DatasheetCard";
import { GlossaryCard } from "./GlossaryCard";
import { FlipIcon } from "./Glyphs";
import {
  type Binding,
  type DeckPage,
  impose,
  type Paper,
  type PaperSide,
  type Squeeze,
} from "./printOrder";
import { StratagemCard } from "./StratagemCard";
import { type CardTheme, themeFor } from "./themes";
import type { SharedFit } from "./useFitText";

/**
 * The deck as it prints: A5 landscape pages, or two of them to each A4 sheet.
 * Double-sided, each sheet shows one side at a time on screen with a control to
 * turn it over, so the deck scrolls at half the length; printing still sends
 * every side, fronts and backs in order.
 */
export function Deck({
  army,
  pages,
  numbers,
  duplex,
  binding,
  paper,
  cover,
  fontsReady,
  onSpill,
  onWargearSpill,
  eager = false,
}: {
  army: Army;
  pages: DeckPage[];
  numbers: Map<string, number>;
  /** Double-sided: every second page is the back of the one before. */
  duplex: boolean;
  binding: Binding;
  paper: Paper;
  /** What the cover page shows, when the deck has one. */
  cover: Pick<Cover, "settings" | "image">;
  fontsReady: boolean;
  /** A rules page that doesn't fit even at its smallest type: its card needs more pages. */
  onSpill: (kind: keyof Squeeze) => void;
  /** A unit's wargear page that doesn't fit even at its smallest type: it needs another page. */
  onWargearSpill: (unitId: string) => void;
  /** Render every sheet at once, as for printing straight away, rather than a few at a time. */
  eager?: boolean;
}) {
  const theme = themeFor(army.faction);

  // The pages of one card (the rules reference, a long army rules card) all take
  // the smallest type size any of them needs, so a bound booklet's pages match.
  const [fits, setFits] = useState<Record<string, number>>({});
  const report = useCallback((id: string, size: number) => {
    setFits((previous) => (previous[id] === size ? previous : { ...previous, [id]: size }));
  }, []);
  const sharedFor = (page: DeckPage): SharedFit | undefined => {
    if (page.kind !== "glossary" && page.kind !== "army-rules") return undefined;
    const sizes = pages.filter((p) => p.kind === page.kind).map((p) => fits[fitId(p)]);
    const cap =
      page.parts > 1 && sizes.every((size) => size !== undefined)
        ? Math.min(...(sizes as number[]))
        : undefined;
    return {
      cap,
      onFit: (size, spills) => {
        report(fitId(page), size);
        if (spills) onSpill(page.kind);
      },
    };
  };
  const faces = {
    army,
    numbers,
    theme,
    fontsReady,
    sharedFor,
    onWargearSpill,
    binding,
    paper,
    cover,
  };
  const sheets = impose(pages, { duplex, paper, binding });

  // A long deck renders a few sheets at a time, letting the page paint in between: each card
  // fits its text as it mounts, and all of them at once froze the page. Printing needs every
  // page, so it renders the rest at once first. A new army starts from the top again.
  const [progress, setProgress] = useState({ army, shown: FIRST_SHEETS });
  const shown = eager
    ? Number.POSITIVE_INFINITY
    : progress.army === army
      ? progress.shown
      : FIRST_SHEETS;
  const complete = shown >= sheets.length;
  useEffect(() => {
    if (complete) return;
    const timer = setTimeout(() => setProgress({ army, shown: shown + SHEETS_PER_STEP }), 0);
    return () => clearTimeout(timer);
  }, [army, complete, shown]);
  useEffect(() => {
    const all = () => flushSync(() => setProgress({ army, shown: Number.POSITIVE_INFINITY }));
    window.addEventListener("beforeprint", all);
    return () => window.removeEventListener("beforeprint", all);
  }, [army]);

  return (
    <div
      className="flex flex-col items-center gap-8 print:gap-0"
      data-deck-complete={complete ? "" : undefined}
    >
      {/* The page size the browser prints to: A5 landscape is the stylesheet's own. */}
      {paper === "a4" ? <style>{"@page { size: A4 portrait; margin: 0; }"}</style> : null}
      {sheets.slice(0, shown).map((sheet, index) => (
        <Sheet
          key={(sheet.front.find(Boolean) ?? sheet.back?.find(Boolean))?.key ?? index}
          number={index + 1}
          {...sheet}
          {...faces}
        />
      ))}
    </div>
  );
}

/** Sheets in the first render, and in each one after, so no single render fits too many cards. */
const FIRST_SHEETS = 2;
const SHEETS_PER_STEP = 2;

type Faces = {
  army: Army;
  numbers: Map<string, number>;
  theme: CardTheme;
  fontsReady: boolean;
  sharedFor: (page: DeckPage) => SharedFit | undefined;
  onWargearSpill: (unitId: string) => void;
  binding: Binding;
  paper: Paper;
  cover: Pick<Cover, "settings" | "image">;
};

/** A page's identity for its shared type size: its place and what it holds, so another list starts afresh. */
function fitId(page: DeckPage): string {
  if (page.kind === "glossary") return `${page.key}|${page.rules.map((r) => r.name).join(",")}`;
  if (page.kind === "army-rules") {
    return `${page.key}|${page.sections.map((s) => `${s.title}:${s.rules.map((r) => r.name)}`).join(";")}`;
  }
  return page.key;
}

/** Nothing printed on this side: no page, or only blank ones. */
const isBlank = (side: PaperSide) => side.every((page) => !page || page.kind === "blank");

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
}: { number: number; front: PaperSide; back?: PaperSide } & Faces) {
  const [flipped, setFlipped] = useState(false);
  const shown = flipped && back ? back : front;
  const size = faces.paper === "a4" ? "A4 sheet" : "Sheet";

  return (
    <section className="flex w-full flex-col gap-2 print:gap-0">
      <div className="print-page-label mx-auto flex w-full max-w-[210mm] items-center justify-between gap-4">
        <p className="micro">
          {"// "}
          {back ? `${size} ${number} · ${flipped ? "back" : "front"}` : `Page ${number}`}
          {isBlank(shown) ? " · blank" : ""}
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
          <Face side={front} visible={!flipped || !back} {...faces} />
          {back ? <Face side={back} visible={flipped} back {...faces} /> : null}
        </div>
      </FitToWidth>
    </section>
  );
}

/**
 * One side of a sheet, as it prints: an A5 page, or two A5 pages stacked on A4.
 * Both sides of a sheet share a grid cell; the one not shown is invisible.
 */
function Face({
  side,
  visible,
  back = false,
  paper,
  ...faces
}: { side: PaperSide; visible: boolean; back?: boolean } & Faces) {
  // Two A5 pages to an A4 sheet: each takes half of its 297 mm.
  const height = paper === "a4" ? 148.5 : 148;
  return (
    <div
      aria-hidden={!visible}
      className={`print-page col-start-1 row-start-1 flex w-[210mm] flex-col transition-opacity duration-150 print:visible print:opacity-100 ${
        paper === "a4" ? "h-[297mm]" : "h-[148mm]"
      } ${visible ? "opacity-100" : "pointer-events-none invisible opacity-0"}`}
    >
      {side.map((page, index) => (
        <Page
          // biome-ignore lint/suspicious/noArrayIndexKey: a side's halves are fixed places, top and bottom.
          key={index}
          page={page}
          height={height}
          back={back}
          paper={paper}
          {...faces}
        />
      ))}
    </div>
  );
}

/** One A5 page in its place on a side of paper: a card filling it, four stratagems, or nothing. */
function Page({
  page,
  height,
  back,
  army,
  numbers,
  theme,
  fontsReady,
  sharedFor,
  onWargearSpill,
  binding,
  cover,
}: { page?: DeckPage; height: number; back: boolean } & Faces) {
  const edge = boundEdge(binding, back);
  // A full card reaches past its 200 × 135 mm to the page's edges all round.
  const bleed: Edges = { left: 5, right: 5, top: (height - 135) / 2, bottom: (height - 135) / 2 };
  return (
    <div
      className={`flex w-[210mm] shrink-0 items-center justify-center ${
        !page || page.kind === "blank"
          ? "outline outline-1 -outline-offset-1 outline-dashed outline-line"
          : // A stratagem page is paper between and around its cards, so nothing on it prints white.
            page.kind === "stratagems"
            ? "bg-paper"
            : "bg-white/5"
      }`}
      style={{ height: `${height}mm` }}
    >
      <CardFrame value={{ bleed, bound: edge }}>
        {page?.kind === "cover" ? (
          <CoverCard
            army={army}
            settings={cover.settings}
            image={cover.image}
            theme={theme}
            fontsReady={fontsReady}
          />
        ) : null}
        {page?.kind === "datasheet" ? (
          <DatasheetCard
            sheet={page.unit}
            number={numbers.get(page.unit.id)}
            theme={theme}
            fontsReady={fontsReady}
          />
        ) : null}
        {page?.kind === "wargear" ? (
          <WargearCard
            sheet={page.unit}
            items={page.items}
            part={page.part}
            parts={page.parts}
            number={numbers.get(page.unit.id)}
            theme={theme}
            fontsReady={fontsReady}
            onSpill={() => onWargearSpill(page.unit.id)}
          />
        ) : null}
        {page?.kind === "army-rules" ? (
          <ArmyRulesCard
            army={army}
            sections={page.sections}
            part={page.part}
            parts={page.parts}
            theme={theme}
            fontsReady={fontsReady}
            shared={sharedFor(page)}
          />
        ) : null}
        {page?.kind === "glossary" ? (
          <GlossaryCard
            army={army}
            rules={page.rules}
            part={page.part}
            parts={page.parts}
            theme={theme}
            fontsReady={fontsReady}
            shared={sharedFor(page)}
          />
        ) : null}
        {page?.kind === "stratagems" ? (
          // Each card in its corner of the page, whether or not the page is full.
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[5mm]">
            {page.stratagems.map((stratagem, index) => (
              <CardFrame
                key={stratagem.id}
                value={{
                  bleed: stratagemBleed(index, height),
                  bound: onGridEdge(edge, index),
                }}
              >
                <StratagemCard stratagem={stratagem} theme={theme} fontsReady={fontsReady} />
              </CardFrame>
            ))}
          </div>
        ) : null}
      </CardFrame>
    </div>
  );
}

/**
 * A stratagem card's reach to the page's edges: four 96 × 64 mm cards, 5 mm
 * apart, leave 6.5 mm at the sides and the rest of the page's height (7.5 mm on
 * A5) at the top and bottom. Only the outer sides reach; the gaps between cards stay.
 */
function stratagemBleed(index: number, height: number): Edges {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const vertical = (height - 133) / 2;
  return {
    left: column === 0 ? 6.5 : 0,
    right: column === 1 ? 6.5 : 0,
    top: row === 0 ? vertical : 0,
    bottom: row === 1 ? vertical : 0,
  };
}

/** A stratagem card's bound edge: only cards in the 2 by 2 grid's row or column along it have one. */
function onGridEdge(edge: PadEdge | undefined, index: number): PadEdge | undefined {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const along =
    edge === "left"
      ? column === 0
      : edge === "right"
        ? column === 1
        : edge === "top"
          ? row === 0
          : row === 1;
  return edge && along ? edge : undefined;
}
