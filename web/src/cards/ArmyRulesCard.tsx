import type { Army } from "../../../shared/types";
import { CardShell } from "./DatasheetCard";
import { Emblem } from "./Glyphs";
import { Rich, SectionBar } from "./parts";
import type { RulesSection } from "./printOrder";
import type { CardTheme } from "./themes";
import { type SharedFit, useFitText } from "./useFitText";

/**
 * The deck's first card: the army rule, each detachment's rules and the
 * enhancements taken, so none of them has to live on a unit's card.
 */
export function ArmyRulesCard({
  army,
  sections,
  part,
  parts,
  theme,
  fontsReady,
  shared,
}: {
  army: Army;
  sections: RulesSection[];
  part: number;
  parts: number;
  theme: CardTheme;
  fontsReady: boolean;
  /** Held to the same type size as the card's other pages. */
  shared?: SharedFit;
}) {
  const body = useFitText<HTMLDivElement>(7.2, 5, sections, fontsReady, undefined, shared);
  const size = army.battleSize
    ? `${army.battleSize.name} · ${army.battleSize.points.toLocaleString("en")} points`
    : "";

  return (
    <CardShell
      theme={theme}
      keywordsLabel="Detachments"
      keywords={army.detachments}
      factionKeywords={[army.faction]}
      header={
        <div className="relative z-10 flex w-full items-center gap-[5mm] px-[4mm]">
          <div className="min-w-0 flex-1">
            <p className="font-condensed text-[7pt] font-bold uppercase tracking-[0.18em] text-white/75">
              {["Army rules", size, parts > 1 ? `${part} of ${parts}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h2 className="font-condensed text-[20pt] font-extrabold uppercase leading-none">
              {army.faction}
            </h2>
            {army.disposition ? (
              <p className="mt-[1.2mm] font-card text-[7.5pt] italic text-white/80">
                {army.disposition}
              </p>
            ) : null}
          </div>
          <Emblem className="h-[24mm] w-[24mm] shrink-0 text-white/25" />
        </div>
      }
    >
      <div
        ref={body}
        className="min-h-0 flex-1 overflow-hidden px-[2.5mm] py-[2mm] [column-fill:auto] [column-gap:4mm] [columns:2]"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        {sections.map((section) => (
          <section key={section.title} className="mb-[1.6mm]">
            <div className="break-inside-avoid">
              <SectionBar title={section.title} />
            </div>
            <div className="px-[1.6mm]">
              {section.rules.map((rule) => (
                <div key={rule.name} className="mt-[1mm] leading-snug">
                  <p className="break-after-avoid font-condensed text-[1.1em] font-bold uppercase">
                    {rule.name}
                    {rule.note ? (
                      <span className="ml-[1.5mm] text-[0.85em] font-semibold text-[var(--accent)]">
                        {rule.note}
                      </span>
                    ) : null}
                  </p>
                  <div className="[&_b]:font-condensed [&_b]:uppercase [&_li]:ml-[3mm] [&_li]:list-disc [&_p+p]:mt-[0.8mm]">
                    <Rich html={rule.html} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </CardShell>
  );
}
