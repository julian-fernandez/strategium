import type { Army, Stratagem } from "../../../shared/types";
import { StratagemCard } from "../cards/StratagemCard";
import { themeFor } from "../cards/themes";

const PHASES: [string, string, RegExp][] = [
  ["I", "Command phase", /command/i],
  ["II", "Movement phase", /movement/i],
  ["III", "Shooting phase", /shooting/i],
  ["IV", "Charge phase", /charge/i],
  ["V", "Fight phase", /fight/i],
  ["VI", "Any phase", /any/i],
];

/** Stratagems by phase. One that spans two phases shows under both. */
export function StratagemsView({ army, fontsReady }: { army: Army; fontsReady: boolean }) {
  const theme = themeFor(army.faction);
  return (
    <div className="flex flex-col gap-10">
      <p className="micro">
        {"// "}
        {army.stratagems.length} stratagems · core and {army.detachments.join(", ")} · only those a
        unit in this army can use
      </p>
      {PHASES.map(([numeral, label, pattern]) => {
        const stratagems = army.stratagems.filter((s: Stratagem) => pattern.test(s.phase));
        if (!stratagems.length) return null;
        return (
          <section key={numeral} className="flex flex-col gap-4">
            <h2 className="flex items-baseline gap-4 border-b border-line pb-2">
              <span className="text-[28px] font-extrabold leading-none">{numeral}</span>
              <span className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-dim">
                {label}
              </span>
              <span className="micro ml-auto">{stratagems.length}</span>
            </h2>
            <div className="flex flex-wrap gap-4">
              {stratagems.map((stratagem) => (
                <StratagemCard
                  key={stratagem.id}
                  stratagem={stratagem}
                  theme={theme}
                  fontsReady={fontsReady}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
