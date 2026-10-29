import type { Ability, Army } from "../../../shared/types";
import { CardShell } from "./DatasheetCard";
import { Emblem } from "./Glyphs";
import { Rich } from "./parts";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

/**
 * A rules reference page: the full text of every core ability, faction rule
 * and weapon keyword the cards name, alphabetically, so the table needs no rulebook.
 */
export function GlossaryCard({
  army,
  rules,
  part,
  parts,
  theme,
  fontsReady,
}: {
  army: Army;
  rules: Ability[];
  part: number;
  parts: number;
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const body = useFitText<HTMLDivElement>(6.4, 4.6, rules, fontsReady);

  return (
    <CardShell
      theme={theme}
      keywords={[]}
      factionKeywords={[army.faction]}
      header={
        <div className="relative z-10 flex w-full items-center gap-[5mm] px-[4mm]">
          <div className="min-w-0 flex-1">
            <p className="font-condensed text-[7pt] font-bold uppercase tracking-[0.18em] text-white/75">
              {[
                "Core abilities · faction rules · weapon keywords",
                parts > 1 ? `${part} of ${parts}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h2 className="font-condensed text-[20pt] font-extrabold uppercase leading-none">
              Rules reference
            </h2>
          </div>
          <Emblem className="h-[24mm] w-[24mm] shrink-0 text-white/25" />
        </div>
      }
    >
      <div
        ref={body}
        className="min-h-0 flex-1 overflow-hidden px-[3mm] py-[2mm] [column-fill:auto] [column-gap:4mm] [column-rule:0.2mm_solid_var(--color-paper-rule)] [columns:3]"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        {rules.map((rule) => (
          <div key={rule.name} className="mb-[1.4mm] leading-snug">
            <p className="break-after-avoid border-b border-paper-rule font-condensed text-[1.15em] font-extrabold uppercase text-[var(--accent)]">
              {rule.name}
            </p>
            <div className="mt-[0.5mm] [&_b]:font-condensed [&_b]:uppercase [&_li]:ml-[3mm] [&_li]:list-disc [&_p+p]:mt-[0.6mm]">
              <Rich html={rule.html} />
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}
