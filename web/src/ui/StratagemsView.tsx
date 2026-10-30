import { useMemo, useState } from "react";
import { unitLabel } from "../../../shared/labels";
import type { Army, Stratagem } from "../../../shared/types";
import { StratagemCard } from "../cards/StratagemCard";
import { type CardTheme, themeFor } from "../cards/themes";
import { search, searchableStratagems } from "../play/lookup";
import { MomentPicker, useMoment } from "../play/MomentPicker";
import { playEntries, usableNow } from "../play/playOrder";
import { FitToWidth } from "./FitToWidth";
import { useWidth } from "./layout";
import { SearchField } from "./SearchField";
import { StratagemRows } from "./StratagemRows";

const PHASES: [string, string, RegExp][] = [
  ["I", "Command phase", /command/i],
  ["II", "Movement phase", /movement/i],
  ["III", "Shooting phase", /shooting/i],
  ["IV", "Charge phase", /charge/i],
  ["V", "Fight phase", /fight/i],
  ["VI", "Any phase", /any/i],
];

/** Below this width the stratagems are rows to tap rather than printed cards. */
const CARDS_WIDTH = 1000;

/**
 * The army's stratagems, narrowed by what you type, the phase and turn (the
 * same setting as Play), the unit using them and their cost. Rows to tap on a
 * phone or tablet; the printed cards, by phase, on a wider screen.
 */
export function StratagemsView({
  army,
  numbers,
  fontsReady,
}: {
  army: Army;
  numbers: Map<string, number>;
  fontsReady: boolean;
}) {
  const theme = themeFor(army.faction);
  const [moment, setMoment] = useMoment();
  const [query, setQuery] = useState("");
  const [unitKey, setUnitKey] = useState("");
  const [cost, setCost] = useState("");
  const [area, width] = useWidth<HTMLDivElement>();
  const entries = useMemo(() => playEntries(army), [army]);
  const indexed = useMemo(() => searchableStratagems(army.stratagems), [army.stratagems]);
  const costs = [...new Set(army.stratagems.map((s) => s.cp))].sort();
  const unit = entries.find((entry) => entry.key === unitKey);

  const shown = search(indexed, query).filter(
    (stratagem) =>
      usableNow(stratagem, moment.phase, moment.turn) &&
      (!unit || unit.stratagems.includes(stratagem)) &&
      (!cost || stratagem.cp === cost),
  );
  const filtered = shown.length < army.stratagems.length;

  return (
    <div ref={area} className="flex flex-col gap-6">
      <p className="micro">
        {"// "}
        {army.stratagems.length} stratagems · core and {army.detachments.join(", ")} · only those a
        unit in this army can use
      </p>

      <div className="flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search stratagems" />
        <MomentPicker moment={moment} onMoment={setMoment} />
        <div className="flex flex-wrap gap-2">
          <select
            value={unitKey}
            onChange={(event) => setUnitKey(event.target.value)}
            aria-label="Unit using it"
            className="h-10 min-w-0 flex-1 basis-[220px] bg-ground-deep px-3 text-[16px] text-ink hairline focus:border-line-strong focus:outline-none md:text-[14px]"
          >
            <option value="">Any unit</option>
            {entries.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {[entry.unit, ...entry.characters].map((s) => unitLabel(s, numbers)).join(" + ")}
              </option>
            ))}
          </select>
          <fieldset className="flex gap-1 border-0 p-0" aria-label="Cost">
            {["", ...costs].map((value) => (
              <button
                key={value || "any"}
                type="button"
                aria-pressed={cost === value}
                onClick={() => setCost(value)}
                className={`h-10 min-w-11 border px-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ${
                  cost === value
                    ? "border-ink bg-ink text-ground-deep"
                    : "border-line text-ink-dim hover:border-line-strong"
                }`}
              >
                {value ? `${value}CP` : "Any CP"}
              </button>
            ))}
          </fieldset>
        </div>
      </div>

      {width === 0 ? null : width < CARDS_WIDTH ? (
        <StratagemRows
          title="Stratagems"
          count={filtered ? `${shown.length} of ${army.stratagems.length}` : String(shown.length)}
          stratagems={shown}
          empty="No stratagem matches. Try another phase, Both turns, or Any unit."
        />
      ) : (
        <PrintedCards stratagems={shown} theme={theme} fontsReady={fontsReady} />
      )}
    </div>
  );
}

/** The printed cards by phase. One that spans two phases shows under both. */
function PrintedCards({
  stratagems,
  theme,
  fontsReady,
}: {
  stratagems: Stratagem[];
  theme: CardTheme;
  fontsReady: boolean;
}) {
  if (!stratagems.length) {
    return (
      <p className="text-[14px] text-ink-dim">
        No stratagem matches. Try another phase, Both turns, or Any unit.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      {PHASES.map(([numeral, label, pattern]) => {
        const inPhase = stratagems.filter((s) => pattern.test(s.phase));
        if (!inPhase.length) return null;
        return (
          <section key={numeral} className="flex flex-col gap-4">
            <h2 className="flex items-baseline gap-4 border-b border-line pb-2">
              <span className="text-[28px] font-extrabold leading-none">{numeral}</span>
              <span className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-dim">
                {label}
              </span>
              <span className="micro ml-auto">{inPhase.length}</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(96mm,1fr))]">
              {inPhase.map((stratagem) => (
                <FitToWidth key={stratagem.id}>
                  <StratagemCard stratagem={stratagem} theme={theme} fontsReady={fontsReady} />
                </FitToWidth>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
