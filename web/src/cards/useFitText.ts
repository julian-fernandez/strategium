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
) {
  const ref = useRef<T>(null);
  const widths = sideWidths?.join(",");

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || content === undefined) return;

    const candidates = widths ? widths.split(",").map(Number) : [undefined];
    let best = { size: -1, width: candidates[0] };
    for (const width of candidates) {
      if (width) element.style.setProperty("--side", `${width}mm`);
      const size = shrink(element, base, min);
      if (size > best.size) best = { size, width };
    }
    if (best.width) element.style.setProperty("--side", `${best.width}mm`);
    element.style.setProperty("--fit", String(best.size));
    element.dataset.fitReady = String(fontsReady);
  }, [base, min, content, fontsReady, widths]);

  return ref;
}

function shrink(element: HTMLElement, base: number, min: number): number {
  let size = base;
  element.style.setProperty("--fit", String(size));
  while (overflows(element) && size > min) {
    size = Math.max(min, size - STEP);
    element.style.setProperty("--fit", String(size));
  }
  return size;
}

function overflows(element: HTMLElement): boolean {
  if (element.scrollHeight > element.clientHeight + 1) return true;
  // CSS columns overflow sideways, into an extra column, rather than downwards.
  if (element.scrollWidth > element.clientWidth + 1) return true;
  for (const child of element.querySelectorAll<HTMLElement>("[data-fit-column]")) {
    if (child.scrollHeight > child.clientHeight + 1) return true;
  }
  return false;
}
