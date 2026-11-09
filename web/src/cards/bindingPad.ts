import { createContext } from "react";
import type { Binding } from "./printOrder";

/** A card's edge that faces a spiral or rings, when the deck is bound. */
export type PadEdge = "left" | "right" | "top" | "bottom";

/**
 * The bound edge of the card being drawn, if any. The deck sets it for each
 * card on a bound page; the card makes room along that edge, and text fitting
 * measures again in what's left.
 */
export const BindingPad = createContext<PadEdge | undefined>(undefined);

/**
 * The room a card makes along its bound edge. Cards already sit about 5 mm in
 * from the page's edge, so the holes get about 10 mm clear of any text.
 */
const PAD_MM = 5;

/**
 * The room on each edge of a card, in mm: the bound edge's, 0 elsewhere. The
 * card keeps its size and place; its coloured bands run on into this room and
 * only their contents, and the text between them, keep clear of it.
 */
export function padding(edge: PadEdge | undefined): Record<PadEdge, number> {
  return {
    left: edge === "left" ? PAD_MM : 0,
    right: edge === "right" ? PAD_MM : 0,
    top: edge === "top" ? PAD_MM : 0,
    bottom: edge === "bottom" ? PAD_MM : 0,
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
