import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STEP = 0.25;

/**
 * Shrinks a box's text until it stops overflowing. Cards set their sizes in
 * `calc(var(--fit) * 1pt)`, so one variable scales the whole block.
 *
 * With `sideWidths` (in mm) it also tries each width for the `--side` column
 * and keeps the one that fits the largest text, so a unit with few weapons
 * and long abilities gives the abilities more room.
 *
 * It measures again when `content` changes, once the real fonts have loaded,
 * and whenever another font face arrives later (a weight a card uses first).
 */
export function useFitText<T extends HTMLElement>(
  base: number,
  min: number,
  content: unknown,
  fontsReady: boolean,
  sideWidths?: number[],
  shared?: SharedFit,
) {
  const ref = useRef<T>(null);
  const widths = sideWidths?.join(",");
  const cap = shared?.cap;
  const report = useRef(shared?.onFit);
  report.current = shared?.onFit;
  const fontLoads = useFontLoads();
  // The last measurement and what it was of: a new shared size alone needs no new one.
  const measured = useRef<{ of: unknown[]; best: Best }>(undefined);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || content === undefined) return;

    // A font arriving changes the text's width, so it counts as something new to measure.
    const of = [base, min, content, fontsReady, fontLoads, widths];
    const last = measured.current;
    const best = last?.of.every((value, index) => value === of[index])
      ? last.best
      : measure(element, base, min, widths);
    measured.current = { of, best };
    if (best.width) element.style.setProperty("--side", `${best.width}mm`);
    element.style.setProperty("--fit", String(Math.min(best.size, cap ?? best.size)));
    element.dataset.fitReady = String(fontsReady);
    report.current?.(best.size, best.over > 0);
  }, [base, min, content, fontsReady, fontLoads, widths, cap]);

  return ref;
}

type Best = { size: number; over: number; width?: number };

/**
 * The largest size the text fits at, and the side width that allows it.
 * Measured from the full size every time, so a shared size can grow again
 * when, say, a late font makes every page fit larger.
 */
function measure(element: HTMLElement, base: number, min: number, widths?: string): Best {
  const candidates = widths ? widths.split(",").map(Number) : [undefined];
  let best: Best = { size: -1, over: Number.POSITIVE_INFINITY, width: candidates[0] };
  for (const width of candidates) {
    if (width) element.style.setProperty("--side", `${width}mm`);
    // Another width only matters if it fits a step larger than the best so far.
    const floor = best.over === 0 ? Math.min(base, best.size + STEP) : min;
    const size = largestFit(element, base, floor);
    if (size !== undefined) {
      best = { size, over: 0, width };
      if (size >= base) break;
    } else if (floor === min) {
      // Nothing fits even at the smallest size: the width that spills least wins.
      const over = spill(element);
      if (over < best.over) best = { size: min, over, width };
    }
  }
  return best;
}

/** Counts the font loads that finish after the page first settles, so text can be measured again. */
function useFontLoads(): number {
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    const onDone = () => setLoads((count) => count + 1);
    fonts.addEventListener("loadingdone", onDone);
    return () => fonts.removeEventListener("loadingdone", onDone);
  }, []);
  return loads;
}

/**
 * For pages that must share one type size (the rules reference's pages):
 * each reports the largest size it fits at on its own, and is shown at `cap`,
 * the smallest of them. `spills` is true when even the smallest size doesn't fit.
 */
export type SharedFit = { cap?: number; onFit: (size: number, spills: boolean) => void };

/**
 * The largest size, in steps down from `base` to `min`, at which the text
 * fits, found by halving the steps rather than trying each one (each try is
 * a layout); undefined when even `min` spills. Leaves the box at that size,
 * or at `min`.
 */
function largestFit(element: HTMLElement, base: number, min: number): number | undefined {
  const sizeAt = (step: number) => Math.max(min, Math.round((base - step * STEP) * 100) / 100);
  const fits = (step: number) => {
    element.style.setProperty("--fit", String(sizeAt(step)));
    return spill(element) === 0;
  };
  if (fits(0)) return base;
  const last = Math.ceil((base - min) / STEP - 1e-9);
  if (last === 0 || !fits(last)) return undefined;
  // The first step spills and the last fits: halve the steps between them.
  let spilling = 0;
  let fitting = last;
  while (fitting - spilling > 1) {
    const middle = (spilling + fitting) >> 1;
    if (fits(middle)) fitting = middle;
    else spilling = middle;
  }
  element.style.setProperty("--fit", String(sizeAt(fitting)));
  return sizeAt(fitting);
}

/** How many pixels of text run past the box, or 0 when it all fits. */
function spill(element: HTMLElement): number {
  const columns = [...element.querySelectorAll<HTMLElement>("[data-fit-column]")];
  const over = Math.max(
    element.scrollHeight - element.clientHeight,
    // CSS columns overflow sideways, into an extra column, rather than downwards.
    element.scrollWidth - element.clientWidth,
    ...columns.map((column) => column.scrollHeight - column.clientHeight),
  );
  return over > 1 ? over : 0;
}
