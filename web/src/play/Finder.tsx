import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { unitLabel } from "../../../shared/labels";
import type { Army } from "../../../shared/types";
import { phaseNumeral } from "../cards/StratagemCard";
import { useRules } from "../rules/Rules";
import { SearchField } from "../ui/SearchField";
import { UnitChips } from "../ui/UnitChips";
import {
  armyRuleIndex,
  holders,
  search,
  searchableRules,
  searchableStratagems,
  searchableUnits,
} from "./lookup";
import { entryFor, type PlayEntry } from "./playOrder";

/** How many results a group shows before "show all". */
const FIRST = 6;
/** The least height the results get, however little room the screen has. */
const MIN_ROOM = 160;

/** One result: what it says, and what choosing it does. */
type Hit = { key: string; title: string; detail?: string; aside?: string; choose: () => void };

/**
 * One box to find anything mid-game. Results come as you type: units (by
 * name, number, model or the character leading them), stratagems and rules
 * (by name, then by text). A unit opens in Play; a stratagem or rule opens
 * over the page, so you don't lose your place, with links to the units that
 * can use it. The arrow keys move through the results and Enter opens one.
 */
export function Finder({
  army,
  entries,
  numbers,
  onUnit,
  onFocus,
}: {
  army: Army;
  entries: PlayEntry[];
  numbers: Map<string, number>;
  onUnit: (entry: PlayEntry) => void;
  onFocus?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [room, setRoom] = useState<number>();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
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

  // The results reach down to whatever is in the way: the keyboard, or the tab bar.
  const measureRoom = useCallback(() => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    const view = window.visualViewport;
    let bottom = view ? view.offsetTop + view.height : window.innerHeight;
    const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
    if (nav?.offsetHeight) bottom = Math.min(bottom, nav.getBoundingClientRect().top);
    setRoom(Math.max(MIN_ROOM, bottom - box.bottom - 8));
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    measureRoom();
    const view = window.visualViewport;
    view?.addEventListener("resize", measureRoom);
    window.addEventListener("scroll", measureRoom, { passive: true });
    window.addEventListener("resize", measureRoom);
    return () => {
      view?.removeEventListener("resize", measureRoom);
      window.removeEventListener("scroll", measureRoom);
      window.removeEventListener("resize", measureRoom);
    };
  }, [open, measureRoom]);

  const done = () => {
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };
  const openUnit = (unitId: string) => {
    const entry = entryFor(entries, unitId);
    if (entry) onUnit(entry);
  };

  const typed = query.trim();
  const groups: { title: string; hits: Hit[] }[] = typed
    ? [
        {
          title: "Units",
          hits: search(units, typed).map((entry) => ({
            key: `unit:${entry.key}`,
            title: unitLabel(entry.unit, numbers),
            detail: entry.characters.length
              ? `+ ${entry.characters.map((c) => unitLabel(c, numbers)).join(", ")}`
              : `${entry.unit.modelCount} ${entry.unit.modelCount === 1 ? "model" : "models"}`,
            choose: () => {
              onUnit(entry);
              done();
            },
          })),
        },
        {
          title: "Stratagems",
          hits: search(stratagems, typed).map((stratagem) => ({
            key: `stratagem:${stratagem.id}`,
            title: stratagem.name,
            detail: stratagem.when,
            aside: `${phaseNumeral(stratagem.phase)} · ${stratagem.cp}CP`,
            choose: () => {
              // The units that can use it, unless that's every unit or none in particular.
              const users =
                stratagem.everyUnit || stratagem.usableBy.length === 0
                  ? []
                  : entries.filter((entry) => entry.stratagems.includes(stratagem));
              show(
                stratagem,
                `Stratagem · ${stratagem.cp}CP · ${stratagem.detachment || "Core"}`,
                (close) => (
                  <UnitChips
                    title="Used by"
                    units={users.map((entry) => ({
                      key: entry.key,
                      label: unitLabel(entry.unit, numbers),
                    }))}
                    onPick={(key) => {
                      close();
                      const entry = entries.find((e) => e.key === key);
                      if (entry) onUnit(entry);
                    }}
                  />
                ),
              );
              setOpen(false);
            },
          })),
        },
        {
          title: "Rules",
          hits: search(rules, typed).map((rule) => ({
            key: `rule:${rule.key}`,
            title: rule.name,
            detail: holders(rule, army, numbers),
            aside: rule.source,
            choose: () => {
              show(rule, rule.source, (close) => (
                <UnitChips
                  title="Has it"
                  units={rule.unitIds.flatMap((id) => {
                    const unit = army.units.find((u) => u.id === id);
                    return unit ? [{ key: id, label: unitLabel(unit, numbers) }] : [];
                  })}
                  onPick={(id) => {
                    close();
                    openUnit(id);
                  }}
                />
              ));
              setOpen(false);
            },
          })),
        },
      ]
    : [];
  const shown = groups.map((group) => ({
    ...group,
    shown: expanded.includes(group.title) ? group.hits : group.hits.slice(0, FIRST),
  }));
  const flat = shown.flatMap((group) => group.shown);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  // Keep the result the arrow keys reached in view.
  useLayoutEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <div ref={root} className="relative">
      <SearchField
        inputRef={input}
        value={query}
        onChange={(value) => {
          setQuery(value);
          setActive(0);
          setExpanded([]);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive(Math.max(0, Math.min(flat.length - 1, current + step)));
          } else if (event.key === "Enter") {
            // Otherwise the same key press clicks the Close button of the sheet it opens.
            event.preventDefault();
            flat[current]?.choose();
          }
        }}
        placeholder="Find a unit, stratagem or rule"
      />
      {open && typed ? (
        <div
          ref={list}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-y-auto overscroll-contain border border-line-strong bg-ground-deep shadow-[0_12px_32px_rgb(0_0_0/0.5)]"
          style={{ maxHeight: room ?? "70vh" }}
        >
          {shown.map((group) =>
            group.hits.length ? (
              <section key={group.title} className="border-b border-line last:border-b-0">
                <h3 className="micro flex justify-between px-4 pb-1 pt-3">
                  <span className="text-ink">{group.title}</span>
                  <span>{group.hits.length}</span>
                </h3>
                <ul>
                  {group.shown.map((hit) => {
                    const index = flat.indexOf(hit);
                    return (
                      <li key={hit.key}>
                        <button
                          type="button"
                          data-index={index}
                          onClick={hit.choose}
                          onMouseEnter={() => setActive(index)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${
                            index === current ? "bg-panel-strong" : ""
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold leading-snug">
                              {hit.title}
                            </span>
                            {hit.detail ? (
                              <span className="mt-0.5 block text-[12px] leading-snug text-ink-dim">
                                {hit.detail}
                              </span>
                            ) : null}
                          </span>
                          {hit.aside ? (
                            <span className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                              {hit.aside}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {group.hits.length > group.shown.length ? (
                  <button
                    type="button"
                    onClick={() => setExpanded([...expanded, group.title])}
                    className="w-full px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-dim hover:text-ink"
                  >
                    Show all {group.hits.length}
                  </button>
                ) : null}
              </section>
            ) : null,
          )}
          {flat.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-dim">Nothing matches “{typed}”.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
