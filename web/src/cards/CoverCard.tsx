import { useState } from "react";
import type { Army } from "../../../shared/types";
import { cardSize, useCardFrame } from "./bindingPad";
import { type CoverSettings, coverTitle, pointsLine } from "./cover";
import { CARD_MM, HATCH } from "./DatasheetCard";
import { Emblem } from "./Glyphs";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

/** The image's width: from the right edge to just past the card's middle. */
const IMAGE_MM = 120;
/** The image fades in from its left edge, so it melts into the faction's colour. */
const FADE = "linear-gradient(to right, transparent, #000 45%)";

/**
 * The deck's cover, on the front of the first sheet with the army rules behind
 * it: the faction's colour and emblem, its name, and what you chose to add.
 * An image fills the right of the card, top to bottom, fading into the colour
 * on its left, with the words beside it. Without one, the words are centred
 * under the emblem, over a dark band with the detachments and points.
 */
export function CoverCard({
  army,
  settings,
  image,
  theme,
  fontsReady,
}: {
  army: Army;
  settings: CoverSettings;
  /** The image's address: a link, or an upload read back from this browser. */
  image?: string;
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const title = coverTitle(army, settings);
  const message = settings.message.trim();
  const detachments =
    settings.detachments && army.detachments.length ? army.detachments.join(" · ") : undefined;
  const points = settings.points ? pointsLine(army) : undefined;
  // A link that doesn't load leaves the words on their own, centred.
  const [broken, setBroken] = useState<string>();
  const shown = image && image !== broken ? image : undefined;
  // Everything in the column shrinks together, so a long name or message still fits.
  const words = useFitText<HTMLDivElement>(
    10,
    5,
    `${army.faction}|${title}|${message}|${detachments}|${points}|${shown ? "image" : ""}`,
    fontsReady,
  );
  // Printed, the colour (and an image) runs on to the paper's edges; only the words keep in.
  const { bleed, inset: pad, flush } = useCardFrame();
  const background = {
    backgroundColor: theme.header,
    backgroundImage: HATCH,
    ...cardSize(CARD_MM.width, CARD_MM.height, bleed),
  };
  const corners = flush ? "" : "rounded-[2mm]";
  const detachmentsLine = detachments ? (
    <>
      <span className="font-bold text-white/70">Detachments: </span>
      {detachments}
    </>
  ) : null;

  const name = (size: string) => (
    <>
      <h1 className={`mt-[0.35em] font-condensed font-extrabold uppercase leading-[0.95] ${size}`}>
        {army.faction}
      </h1>
      {title ? (
        <p className="mt-[0.45em] text-[1.45em] italic leading-snug text-white/90">{title}</p>
      ) : null}
      {message ? (
        <p className="mt-[1em] max-w-[150mm] whitespace-pre-line leading-snug text-white/85">
          {message}
        </p>
      ) : null}
    </>
  );

  if (shown) {
    return (
      <article
        className={`relative overflow-hidden font-card text-white ${corners}`}
        style={background}
      >
        <img
          src={shown}
          alt=""
          onError={() => setBroken(shown)}
          className="absolute inset-y-0 right-0 h-full object-cover"
          style={{ width: `${IMAGE_MM + bleed.right}mm`, maskImage: FADE, WebkitMaskImage: FADE }}
        />
        {/* The words, centred in the colour beside the image; the detachments and points below them. */}
        <div
          ref={words}
          className="relative flex h-full flex-col items-start overflow-hidden text-left"
          style={{
            fontSize: "calc(var(--fit) * 1pt)",
            padding: `${10 + pad.top}mm ${IMAGE_MM - 10 + bleed.right}mm ${9 + pad.bottom}mm ${10 + pad.left}mm`,
          }}
        >
          <span className="min-h-0 flex-1" />
          <Emblem className="h-[3em] w-[3em] shrink-0 text-white" />
          {name("text-[3em]")}
          <span className="min-h-[1.2em] flex-1" />
          {detachments || points ? (
            <div className="font-condensed text-[0.8em] uppercase leading-tight">
              {detachmentsLine ? <p>{detachmentsLine}</p> : null}
              {points ? <p className="mt-[0.3em] font-bold">{points}</p> : null}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`flex flex-col overflow-hidden font-card text-white ${corners}`}
      style={background}
    >
      <div
        className="flex min-h-0 flex-1"
        style={{ padding: `${10 + pad.top}mm ${10 + pad.right}mm 8mm ${10 + pad.left}mm` }}
      >
        <div
          ref={words}
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center-safe overflow-hidden text-center"
          style={{ fontSize: "calc(var(--fit) * 1pt)" }}
        >
          <Emblem className="h-[6em] w-[6em] shrink-0 text-white" />
          {name("text-[4.4em]")}
        </div>
      </div>
      <footer
        className="flex shrink-0 items-center justify-between gap-[4mm] bg-card-footer font-condensed text-[7.5pt] uppercase"
        style={{
          height: `${12 + pad.bottom}mm`,
          padding: `0 ${6 + pad.right}mm ${pad.bottom}mm ${6 + pad.left}mm`,
        }}
      >
        <p className="min-w-0 leading-tight">{detachmentsLine}</p>
        <p className="shrink-0 font-bold">{points}</p>
      </footer>
    </article>
  );
}
