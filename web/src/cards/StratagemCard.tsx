import type { CSSProperties } from "react";
import { usersOf } from "../../../shared/stratagems";
import type { Stratagem } from "../../../shared/types";
import { Rich } from "./parts";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

const NUMERALS: [RegExp, string][] = [
  [/command/i, "I"],
  [/movement/i, "II"],
  [/shooting/i, "III"],
  [/charge/i, "IV"],
  [/fight/i, "V"],
  [/any/i, "VI"],
];

/** Roman numeral for each phase a stratagem is used in: "Shooting or Fight phase" → "III·V". */
export function phaseNumeral(phase: string): string {
  const numerals = NUMERALS.filter(([pattern]) => pattern.test(phase)).map(
    ([, numeral]) => numeral,
  );
  return numerals.join("·") || "–";
}

const CORE_COLOR = "#3a3e42";

/** 96 × 64 mm: four to an A5 landscape page. */
export function StratagemCard({
  stratagem,
  theme,
  fontsReady,
}: {
  stratagem: Stratagem;
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const body = useFitText<HTMLDivElement>(7, 4.8, stratagem, fontsReady);
  const name = useFitText<HTMLHeadingElement>(10.5, 6.5, stratagem.name, fontsReady);
  const users = usersOf(stratagem) || "Your army";
  const usersLine = useFitText<HTMLElement>(5.8, 4.4, users, fontsReady);
  const band = stratagem.detachment ? theme.header : CORE_COLOR;

  return (
    <article
      className="flex h-[64mm] w-[96mm] flex-col overflow-hidden rounded-[1.6mm] bg-paper font-card text-card-ink"
      style={{ "--accent": theme.accent } as CSSProperties}
    >
      <header
        className="flex h-[12mm] shrink-0 items-center gap-[2mm] px-[2.5mm] text-white"
        style={{ backgroundColor: band }}
      >
        <span className="flex h-[6.5mm] min-w-[6.5mm] items-center justify-center border border-white/60 px-[0.8mm] font-condensed text-[7pt] font-bold">
          {phaseNumeral(stratagem.phase)}
        </span>
        <div className="min-w-0 flex-1">
          {/* A long name shrinks to one line; the details wrap to a second if they need it. */}
          <h3
            ref={name}
            className="overflow-hidden whitespace-nowrap font-condensed font-extrabold uppercase leading-tight"
            style={{ fontSize: "calc(var(--fit) * 1pt)" }}
          >
            {stratagem.name}
          </h3>
          <p className="mt-[0.2mm] font-condensed text-[5.8pt] font-semibold uppercase leading-tight tracking-[0.08em] text-white/75">
            {stratagem.detachment || "Core"} · {stratagem.phase} · {stratagem.turn}
          </p>
        </div>
        <span className="flex h-[7.5mm] w-[7.5mm] rotate-45 items-center justify-center bg-white">
          <span className="-rotate-45 font-condensed text-[8pt] font-extrabold leading-none text-[#2b2b29]">
            {stratagem.cp}
            <span className="text-[5pt]">CP</span>
          </span>
        </span>
      </header>
      <div
        ref={body}
        className="min-h-0 flex-1 overflow-hidden px-[2.5mm] py-[1.6mm] leading-snug [&_b]:font-condensed [&_b]:uppercase"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        <Rich html={stratagem.html} />
      </div>
      {/* Held to a few lines, its text shrinking, so a long list of users can't crowd out the rule. */}
      <footer
        ref={usersLine}
        className="max-h-[8mm] shrink-0 overflow-hidden border-t border-paper-rule px-[2.5mm] py-[1mm] font-condensed uppercase leading-tight text-[#4a4a44]"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        <b className="text-card-ink">Usable by: </b>
        {users}
      </footer>
    </article>
  );
}
