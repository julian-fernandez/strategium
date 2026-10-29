import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { unitLabel } from "../../../shared/labels";
import type { Army, Stratagem } from "../../../shared/types";
import { DatasheetCard } from "../cards/DatasheetCard";
import { themeFor } from "../cards/themes";
import { ArmyRulesPanel } from "../rules/ArmyRulesPanel";
import { FitToWidth } from "../ui/FitToWidth";
import { READABLE_CARD_WIDTH, useWidth } from "../ui/layout";
import { StratagemRows } from "../ui/StratagemRows";
import { PHASES, type Phase, playEntries, type Turn, usableNow } from "./playOrder";
import { UnitSheet } from "./UnitSheet";

const SWIPE_DISTANCE = 60;
const STORAGE_KEY = "army-cards:play";
/** The "All units" choice in the unit picker. */
const ALL = -1;

/**
 * For playing from a phone or tablet: one unit at a time (or all of them),
 * the stratagems usable right now, and the datasheet sized to the screen.
 */
export function PlayView({
  army,
  numbers,
  fontsReady,
}: {
  army: Army;
  numbers: Map<string, number>;
  fontsReady: boolean;
}) {
  const entries = playEntries(army);
  const [index, setIndex] = useState(0);
  const [{ phase, turn }, setMoment] = useState(loadMoment);
  const theme = themeFor(army.faction);
  const [content, width] = useWidth<HTMLDivElement>();

  const selected = index === ALL ? undefined : entries[Math.min(index, entries.length - 1)];
  const count = entries.length;

  /** Next and previous step through the units; from "All units" they go to the first or last. */
  const go = useCallback(
    (step: number) =>
      setIndex((i) => (i === ALL ? (step > 0 ? 0 : count - 1) : (i + step + count) % count)),
    [count],
  );

  useEffect(() => saveMoment({ phase, turn }), [phase, turn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Swipe left or right on the datasheet to change unit; vertical scrolling is left alone.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const pool = selected ? selected.stratagems : army.stratagems;
  const now = pool.filter((s) => usableNow(s, phase, turn));

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b border-line bg-panel-strong px-4 py-3 backdrop-blur-sm md:-mx-8 md:px-8">
        <div className="grid grid-cols-6 gap-1" role="tablist" aria-label="Phase">
          {PHASES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={phase === item.id}
              onClick={() => setMoment({ phase: item.id, turn })}
              className={`flex min-w-0 flex-col items-center border px-1 py-1.5 transition-colors duration-150 ${
                phase === item.id
                  ? "border-ink bg-ink text-ground-deep"
                  : "border-line text-ink-dim hover:border-line-strong"
              }`}
            >
              <span className="text-[15px] font-extrabold leading-none">{item.numeral}</span>
              <span className="mt-1 w-full truncate text-center text-[8px] font-semibold uppercase tracking-[0.08em] sm:text-[9px] sm:tracking-[0.14em]">
                <span className="sm:hidden">{item.short ?? item.label}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </button>
          ))}
        </div>
        <fieldset className="flex gap-1 border-0 p-0" aria-label="Whose turn">
          {(["mine", "theirs"] as Turn[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={turn === item}
              onClick={() => setMoment({ phase, turn: item })}
              className={`flex-1 border py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors duration-150 ${
                turn === item
                  ? "border-faction bg-faction text-ink"
                  : "border-line text-ink-dim hover:border-line-strong"
              }`}
            >
              {item === "mine" ? "My turn" : "Their turn"}
            </button>
          ))}
        </fieldset>
      </div>

      <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5" aria-label="Units">
        <UnitChip
          label="All units"
          detail="Every stratagem"
          active={index === ALL}
          onClick={() => setIndex(ALL)}
        />
        {entries.map((entry, i) => (
          <UnitChip
            key={entry.key}
            label={unitLabel(entry.unit, numbers)}
            detail={
              entry.characters.length
                ? `+ ${entry.characters.map((c) => c.name).join(", ")}`
                : undefined
            }
            active={entry === selected}
            onClick={() => setIndex(i)}
          />
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn h-11 w-11 px-0"
          onClick={() => go(-1)}
          aria-label="Previous unit"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="micro">
            {selected ? `Unit ${entries.indexOf(selected) + 1} / ${count}` : `${count} units`}
          </p>
          <h2 className="truncate text-[20px] font-extrabold uppercase tracking-[0.02em]">
            {selected ? unitLabel(selected.unit, numbers) : "All units"}
          </h2>
        </div>
        <button
          type="button"
          className="btn h-11 w-11 px-0"
          onClick={() => go(1)}
          aria-label="Next unit"
        >
          ›
        </button>
      </div>

      <StratagemRows
        title="Usable now"
        count={`${now.length} of ${pool.length}`}
        stratagems={now}
        empty={
          selected
            ? "Nothing this unit can use in this phase and turn."
            : "Nothing your army can use in this phase and turn."
        }
        usersOf={selected ? undefined : whoCanUse}
      />

      <div
        ref={content}
        className="flex touch-pan-y flex-col gap-4"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {!selected ? (
          <ArmyRulesPanel army={army} />
        ) : width >= READABLE_CARD_WIDTH ? (
          <>
            <FitToWidth max={1.35}>
              <DatasheetCard
                sheet={selected.unit}
                number={numbers.get(selected.unit.id)}
                theme={theme}
                fontsReady={fontsReady}
              />
            </FitToWidth>
            {/* Characters on the same datasheet as every other unit. */}
            {selected.characters.map((character) => (
              <FitToWidth key={character.id} max={1.35}>
                <DatasheetCard
                  sheet={character}
                  number={numbers.get(character.id)}
                  theme={theme}
                  fontsReady={fontsReady}
                />
              </FitToWidth>
            ))}
          </>
        ) : (
          <UnitSheet
            unit={selected.unit}
            characters={selected.characters}
            numbers={numbers}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

function UnitChip({
  label,
  detail,
  active,
  onClick,
}: {
  label: string;
  detail?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`min-w-0 border px-3 py-2 text-left leading-tight transition-colors duration-150 ${
        active
          ? "border-ink bg-panel-strong text-ink shadow-[inset_3px_0_0_var(--color-faction)]"
          : "border-line bg-panel text-ink-dim hover:border-line-strong"
      }`}
    >
      <span className="block text-[13px] font-semibold">{label}</span>
      {detail ? (
        <span className="mt-0.5 block truncate text-[11px] font-medium text-ink-faint">
          {detail}
        </span>
      ) : null}
    </button>
  );
}

/** For the "All units" list: who in the army can use each stratagem. */
function whoCanUse(stratagem: Stratagem): string {
  if (stratagem.everyUnit) return "Every unit";
  if (stratagem.usableBy.length === 0) return "Your army";
  return stratagem.usableBy.join(", ");
}

type Moment = { phase: Phase; turn: Turn };

function loadMoment(): Moment {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Moment>;
    return { phase: saved.phase ?? "all", turn: saved.turn ?? "mine" };
  } catch {
    return { phase: "all", turn: "mine" };
  }
}

function saveMoment(moment: Moment): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(moment));
  } catch {
    // Storage can be unavailable; the phase just won't be remembered.
  }
}
