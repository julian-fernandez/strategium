import type { CSSProperties, ReactNode } from "react";
import type { Datasheet } from "../../../shared/types";
import { Emblem } from "./Glyphs";
import {
  AbilitiesBlock,
  CompositionBlock,
  Rich,
  SectionBar,
  StatBadges,
  splitName,
  WeaponTable,
} from "./parts";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

/** 200 × 135 mm: the official card's proportions, centred on an A5 landscape page. */
export const CARD_SIZE = "h-[135mm] w-[200mm]";

/**
 * Widths the abilities column may take. The official proportion comes first,
 * so it wins ties; 56 mm is for weapon-heavy cards whose left column overflows,
 * 104 and 116 mm for long abilities beside a short weapons list.
 */
export const SIDE_WIDTHS = [68, 80, 92, 56, 104, 116];

const HATCH =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Cpath d='M0 6L6 0' stroke='%23000' stroke-opacity='0.12' stroke-width='1'/%3E%3C/svg%3E\")";

export function CardShell({
  theme,
  header,
  children,
  keywords,
  keywordsLabel = "Keywords",
  factionKeywords,
}: {
  theme: CardTheme;
  header: ReactNode;
  children: ReactNode;
  keywords: string[];
  /** What the footer's left strip lists; the army rules card lists its detachments there. */
  keywordsLabel?: string;
  factionKeywords: string[];
}) {
  const style = { "--accent": theme.accent } as CSSProperties;
  return (
    <article
      className={`${CARD_SIZE} flex flex-col overflow-hidden rounded-[2mm] bg-paper font-card text-card-ink`}
      style={style}
    >
      {/* Grows past 38 mm only for a unit with more stat lines than fit; the body gives way. */}
      <header
        className="relative flex min-h-[38mm] shrink-0 overflow-hidden text-white"
        style={{ backgroundColor: theme.header, backgroundImage: HATCH }}
      >
        {header}
      </header>
      {children}
      <footer className="flex h-[9mm] shrink-0 items-center gap-[3mm] bg-card-footer px-[3mm] font-condensed text-[6.5pt] uppercase text-white">
        <p className="min-w-0 flex-1 leading-tight">
          {keywords.length ? (
            <>
              <span className="font-bold text-white/70">{keywordsLabel}: </span>
              {keywords.join("; ")}
            </>
          ) : null}
        </p>
        <span
          className="flex h-[6mm] w-[6mm] rotate-45 items-center justify-center border border-white/60"
          style={{ backgroundColor: theme.header }}
        >
          <Emblem className="h-[4mm] w-[4mm] -rotate-45" strokeWidth={2.5} />
        </span>
        <p className="leading-tight">
          <span className="block text-[5.5pt] font-bold text-white/70">Faction keywords</span>
          <span className="font-bold">{factionKeywords.join(", ")}</span>
        </p>
      </footer>
    </article>
  );
}

/** "#2" after the unit name, in the same white box as the stats so it reads across the table. */
export function UnitNumber({ value }: { value: number }) {
  return (
    <span className="ml-[2mm] inline-flex h-[0.95em] items-center rounded-[1mm] bg-white px-[1.2mm] align-[0.05em] text-[0.8em] text-[#2b2b29]">
      #{value}
    </span>
  );
}

export function DatasheetCard({
  sheet,
  number,
  theme,
  fontsReady,
}: {
  sheet: Datasheet;
  /** Set when another unit in the army has the same name. */
  number?: number;
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const [title, suffix] = splitName(sheet.name);
  const body = useFitText<HTMLDivElement>(7.6, 5.2, sheet, fontsReady, SIDE_WIDTHS);
  const name = useFitText<HTMLHeadingElement>(20, 11, `${sheet.name}#${number}`, fontsReady);
  const legend = useFitText<HTMLParagraphElement>(6.4, 4.8, sheet.legend, fontsReady);

  return (
    <CardShell
      theme={theme}
      keywords={sheet.keywords}
      factionKeywords={sheet.factionKeywords}
      header={
        <>
          <div className="relative z-10 flex w-[96mm] shrink-0 flex-col justify-between px-[4mm] py-[3mm]">
            <h2
              ref={name}
              className="h-[9mm] shrink-0 overflow-hidden font-condensed font-extrabold uppercase leading-none"
              style={{ fontSize: "calc(var(--fit) * 1pt)" }}
            >
              {title}
              {suffix ? <span className="ml-[1.5mm] text-[0.55em] font-bold">{suffix}</span> : null}
              {number ? <UnitNumber value={number} /> : null}
            </h2>
            {/* Three stat lines at full size would push the name out of the band. */}
            <StatBadges stats={sheet.stats} size={sheet.stats.length > 2 ? "small" : "full"} />
          </div>
          <div className="pointer-events-none absolute left-[96mm] top-0 flex h-full w-[42mm] items-center justify-center text-white/25">
            <Emblem className="h-[26mm] w-[26mm]" />
          </div>
          <p
            ref={legend}
            className="absolute right-[3mm] top-[3mm] h-[32mm] w-[58mm] overflow-hidden text-right italic leading-snug text-white/90"
            style={{ fontSize: "calc(var(--fit) * 1pt)" }}
          >
            {sheet.legend}
          </p>
        </>
      }
    >
      <div
        ref={body}
        className="grid min-h-0 flex-1 grid-cols-[1fr_var(--side,68mm)] gap-[2.5mm] overflow-hidden p-[2.5mm]"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        <div data-fit-column className="flex min-h-0 flex-col gap-[1.5mm] overflow-hidden">
          <WeaponTable rows={sheet.ranged} melee={false} />
          <WeaponTable rows={sheet.melee} melee />
          {sheet.attachTo ? (
            <div>
              <SectionBar title={sheet.attachTo.title} />
              <p className="px-[1.6mm] pt-[0.9mm] leading-snug">
                <Rich html={sheet.attachTo.html} />
              </p>
            </div>
          ) : null}
        </div>
        <div
          data-fit-column
          className="flex min-h-0 flex-col gap-[1.5mm] overflow-hidden border-l border-paper-rule pl-[2.5mm]"
        >
          <AbilitiesBlock sheet={sheet} />
          <CompositionBlock sheet={sheet} />
        </div>
      </div>
    </CardShell>
  );
}
