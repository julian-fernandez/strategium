import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { unitLabel } from "../../../shared/labels";
import type { Army, Stratagem } from "../../../shared/types";
import { phaseNumeral } from "../cards/StratagemCard";
import { useRules } from "../rules/Rules";
import { SearchField } from "../ui/SearchField";
import {
  armyRuleIndex,
  type RuleEntry,
  search,
  searchableRules,
  searchableStratagems,
  searchableUnits,
} from "./lookup";
import type { PlayEntry } from "./playOrder";

/** How many results a group shows before "show all". */
const FIRST = 6;

/**
 * One box to find anything mid-game. Results come as you type: units (by
 * name, number, model or the character leading them), stratagems and rules
 * (by name, then by text). A unit opens in Play; a stratagem or rule opens
 * over the page, so you don't lose your place.
 */
export function Finder({
  army,
  entries,
  numbers,
  onUnit,
}: {
  army: Army;
  entries: PlayEntry[];
  numbers: Map<string, number>;
  onUnit: (entry: PlayEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { show } = useRules();

  const units = useMemo(() => searchableUnits(entries, numbers), [entries, numbers]);
  const stratagems = useMemo(() => searchableStratagems(army.stratagems), [army.stratagems]);
  const rules = useMemo(() => searchableRules(armyRuleIndex(army)), [army]);

  // A tap anywhere else puts the results away; the query stays for when you come back.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const typed = query.trim();
  const found = typed
    ? {
        units: search(units, typed),
        stratagems: search(stratagems, typed),
        rules: search(rules, typed),
      }
    : undefined;
  const done = () => {
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div ref={root} className="relative">
      <SearchField
        inputRef={input}
        value={query}
        onChange={(value) => {
          setQuery(value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const first = found?.units[0];
            if (first) {
              onUnit(first);
              done();
            }
          }
        }}
        placeholder="Find a unit, stratagem or rule"
      />
      {open && found ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto overscroll-contain border border-line-strong bg-ground-deep shadow-[0_12px_32px_rgb(0_0_0/0.5)]">
          <Group key={`units:${typed}`} title="Units" items={found.units}>
            {(entry: PlayEntry) => (
              <Row
                key={entry.key}
                onClick={() => {
                  onUnit(entry);
                  done();
                }}
                title={unitLabel(entry.unit, numbers)}
                detail={
                  entry.characters.length
                    ? `+ ${entry.characters.map((c) => unitLabel(c, numbers)).join(", ")}`
                    : `${entry.unit.modelCount} ${entry.unit.modelCount === 1 ? "model" : "models"}`
                }
              />
            )}
          </Group>
          <Group key={`stratagems:${typed}`} title="Stratagems" items={found.stratagems}>
            {(stratagem: Stratagem) => (
              <Row
                key={stratagem.id}
                onClick={() => {
                  show(
                    stratagem,
                    `Stratagem · ${stratagem.cp}CP · ${stratagem.detachment || "Core"}`,
                  );
                  setOpen(false);
                }}
                title={stratagem.name}
                detail={stratagem.when}
                aside={`${phaseNumeral(stratagem.phase)} · ${stratagem.cp}CP`}
              />
            )}
          </Group>
          <Group key={`rules:${typed}`} title="Rules" items={found.rules}>
            {(rule: RuleEntry) => (
              <Row
                key={rule.key}
                onClick={() => {
                  show(rule, rule.source);
                  setOpen(false);
                }}
                title={rule.name}
                detail={holders(rule, army, numbers)}
                aside={rule.source}
              />
            )}
          </Group>
          {found.units.length + found.stratagems.length + found.rules.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-dim">Nothing matches “{typed}”.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** "Bullgryn Squad #1, Bullgryn Squad #2", for a rule some units have. */
export function holders(rule: RuleEntry, army: Army, numbers: Map<string, number>): string {
  return rule.unitIds
    .map((id) => army.units.find((unit) => unit.id === id))
    .filter((unit) => unit !== undefined)
    .map((unit) => unitLabel(unit, numbers))
    .join(", ");
}

function Group<T>({
  title,
  items,
  children,
}: {
  title: string;
  items: T[];
  children: (item: T) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, FIRST);
  return (
    <section className="border-b border-line last:border-b-0">
      <h3 className="micro flex justify-between px-4 pb-1 pt-3">
        <span className="text-ink">{title}</span>
        <span>{items.length}</span>
      </h3>
      <ul>{shown.map(children)}</ul>
      {items.length > shown.length ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="w-full px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-dim hover:text-ink"
        >
          Show all {items.length}
        </button>
      ) : null}
    </section>
  );
}

function Row({
  title,
  detail,
  aside,
  onClick,
}: {
  title: string;
  detail?: string;
  aside?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-panel-strong"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-snug">{title}</span>
          {detail ? (
            <span className="mt-0.5 block text-[12px] leading-snug text-ink-dim">{detail}</span>
          ) : null}
        </span>
        {aside ? (
          <span className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            {aside}
          </span>
        ) : null}
      </button>
    </li>
  );
}
