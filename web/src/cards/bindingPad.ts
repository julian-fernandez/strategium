import { type CSSProperties, createContext, use } from "react";
import type { Binding } from "./printOrder";

/** A card's edge that faces a spiral or rings, when the deck is bound. */
export type PadEdge = "left" | "right" | "top" | "bottom";

/** A length in mm for each side of a card. */
export type Edges = Record<PadEdge, number>;

/**
 * How a printed card sits on its page. `bleed` is how far the card reaches past
 * its own size on each side, out to the edge of the paper: its colours run on
 * into it, and its contents stay where they'd be on the card alone, so nothing
 * prints white around it. `bound` is the edge facing a spiral or rings, if the
 * deck is bound, which keeps the contents further in.
 *
 * Unset, as on screen outside the printed deck, a card is just its own size,
 * with rounded corners.
 */
export type CardFrame = { bleed: Edges; bound?: PadEdge };
export const CardFrame = createContext<CardFrame | undefined>(undefined);

export const NO_EDGES: Edges = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * The room a card makes along its bound edge. The contents keep the card's own
 * margin there as well, so the nearest text is about 13 mm from the paper's edge.
 */
const PAD_MM = 5;

/**
 * The card's frame, worked out: how far it bleeds, how far in from its outer
 * edge its contents keep on each side, and a key that changes when either does,
 * for text fitting to measure again.
 */
export function useCardFrame(): { bleed: Edges; inset: Edges; flush: boolean; key: string } {
  const frame = use(CardFrame);
  const bleed = frame?.bleed ?? NO_EDGES;
  const extra = (edge: PadEdge) => bleed[edge] + (frame?.bound === edge ? PAD_MM : 0);
  const inset = {
    left: extra("left"),
    right: extra("right"),
    top: extra("top"),
    bottom: extra("bottom"),
  };
  return {
    bleed,
    inset,
    flush: bleed.left + bleed.right + bleed.top + bleed.bottom > 0,
    key: `${inset.left},${inset.right},${inset.top},${inset.bottom}`,
  };
}

/** A card's size, in mm, grown by its bleed. */
export function cardSize(width: number, height: number, bleed: Edges): CSSProperties {
  return {
    width: `${width + bleed.left + bleed.right}mm`,
    height: `${height + bleed.top + bleed.bottom}mm`,
  };
}

/**
 * Which edge of a page faces the binding. A back's is across from its front's,
 * since the sheet turns over it: right for a left binding, bottom for a top one.
 */
export function boundEdge(binding: Binding, back: boolean): PadEdge | undefined {
  if (binding === "left") return back ? "right" : "left";
  if (binding === "top") return back ? "bottom" : "top";
  return undefined;
}
