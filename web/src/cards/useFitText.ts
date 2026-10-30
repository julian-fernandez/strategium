import { useLayoutEffect, useRef } from "react";

const STEP = 0.25;

/**
 * Shrinks a box's text until it stops overflowing. Cards set their sizes in
 * `calc(var(--fit) * 1pt)`, so one variable scales the whole block.
 *
 * With `sideWidths` (in mm) it also tries each width for the `--side` column
 * and keeps the one that fits the largest text, so a unit with few weapons
 * and long abilities gives the abilities more room.
 *
 * It measures again when `content` changes and once the real fonts have loaded.
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

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || content === undefined) return;

    const top = Math.min(base, cap ?? base);
    const candidates = widths ? widths.split(",").map(Number) : [undefined];
    let best = { size: -1, over: Number.POSITIVE_INFINITY, width: candidates[0] };
    for (const width of candidates) {
      if (width) element.style.setProperty("--side", `${width}mm`);
      const size = shrink(element, top, min);
      // When nothing fits even at the smallest size, the width that spills least wins.
      const over = size <= min ? spill(element) : 0;
      if (size > best.size || (size === best.size && over < best.over))
        best = { size, over, width };
    }
    if (best.width) element.style.setProperty("--side", `${best.width}mm`);
    element.style.setProperty("--fit", String(best.size));
    element.dataset.fitReady = String(fontsReady);
    report.current?.(best.size, best.over > 0);
  }, [base, min, content, fontsReady, widths, cap]);

  return ref;
}

/**
 * For pages that must share one type size (the rules reference's pages):
 * each reports the size it fits at, and is held to `cap`, the smallest of them.
 * `spills` is true when even the smallest size doesn't fit.
 */
export type SharedFit = { cap?: number; onFit: (size: number, spills: boolean) => void };

function shrink(element: HTMLElement, base: number, min: number): number {
  let size = base;
  element.style.setProperty("--fit", String(size));
  while (spill(element) > 0 && size > min) {
    size = Math.max(min, size - STEP);
    element.style.setProperty("--fit", String(size));
  }
  return size;
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
