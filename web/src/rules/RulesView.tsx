import { useMemo, useState } from "react";
import { ruleKey } from "../../../shared/bundle";
import { unitLabel } from "../../../shared/labels";
import type { Army } from "../../../shared/types";
import { Rich } from "../cards/parts";
import { armyRuleIndex, holders, search, searchableRules } from "../play/lookup";
import { SearchField } from "../ui/SearchField";
import { UnitChips } from "../ui/UnitChips";

/**
 * Every rule the army uses in one list, alphabetical and searchable by name
 * or text: army and detachment rules, enhancements, core abilities, weapon
 * keywords and each unit's abilities, with the units that have it. Tap a rule
 * to read it; tap a unit to open it in Play.
 */
export function RulesView({
  army,
  numbers,
  onOpenUnit,
}: {
  army: Army;
  numbers: Map<string, number>;
  onOpenUnit: (unitId: string) => void;
}) {
  const rules = useMemo(() => armyRuleIndex(army), [army]);
  const indexed = useMemo(() => searchableRules(rules), [rules]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string>();
  const shown = search(indexed, query);

  return (
    <div className="flex flex-col gap-6">
      <p className="micro">
        {"// "}
        {rules.length} rules · the army's, its detachments', the enhancements taken, and every
        ability and keyword its datasheets name
      </p>
      <SearchField value={query} onChange={setQuery} placeholder="Search rules" />

      <section className="bg-panel hairline">
        <h3 className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
          <span className="micro text-ink">Rules</span>
          <span className="micro">
            {shown.length < rules.length ? `${shown.length} of ${rules.length}` : rules.length}
          </span>
        </h3>
        {shown.length ? (
          <ul>
            {shown.map((rule) => {
              // A search down to one rule shows it whole, without a tap.
              const expanded = open === rule.key || shown.length === 1;
              const units = rule.unitIds
                .map((id) => army.units.find((unit) => unit.id === id))
                .filter((unit) => unit !== undefined);
              return (
                <li key={rule.key} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? undefined : rule.key)}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold uppercase leading-snug tracking-[0.04em]">
                        {rule.name}
                      </span>
                      {units.length && !expanded ? (
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-dim">
                          {holders(rule, army, numbers)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      {rule.source}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="px-4 pb-4">
                      <div className="rules-text text-[14px] leading-relaxed text-ink-dim [&_b]:text-ink">
                        <Rich html={rule.html} self={`rule:${ruleKey(rule.name)}`} />
                      </div>
                      <UnitChips
                        title="Has it"
                        units={units.map((unit) => ({
                          key: unit.id,
                          label: unitLabel(unit, numbers),
                        }))}
                        onPick={onOpenUnit}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[13px] text-ink-dim">Nothing matches “{query.trim()}”.</p>
        )}
      </section>
    </div>
  );
}
