import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { unitLabel } from "../../../shared/labels";
import type { Army } from "../../../shared/types";
import { DatasheetCard } from "../cards/DatasheetCard";
import { themeFor } from "../cards/themes";
import { BottomSheet } from "../ui/BottomSheet";
import { FitToWidth } from "../ui/FitToWidth";
import { READABLE_CARD_WIDTH, useMediaQuery, useWidth } from "../ui/layout";
import { StratagemList } from "../ui/StratagemRows";
import { useStored } from "../ui/useStored";
import { Finder } from "./Finder";
import { MomentPicker, momentLabel, useMoment } from "./MomentPicker";
import { type PlayEntry, playEntries, usableNow } from "./playOrder";
import { UnitList } from "./UnitList";
import { UnitSheet } from "./UnitSheet";

const SWIPE_DISTANCE = 60;

/**
 * For playing from a phone or tablet: find any unit, stratagem or rule from
 * the search box, pick a unit from the list (a sheet on a phone, a column on
 * a tablet), and read its datasheet sized to the screen, with the stratagems
 * it can use right now a tap away.
 */
export function PlayView({
  army,
  numbers,
  fontsReady,
  unitKey,
  onUnitKey,
}: {
  army: Army;
  numbers: Map<string, number>;
  fontsReady: boolean;
  /** The unit shown, remembered by the app so other tabs can open one here. */
  unitKey?: string;
  onUnitKey: (key: string) => void;
}) {
  const entries = useMemo(() => playEntries(army), [army]);
  const selected = entries.find((entry) => entry.key === unitKey) ?? entries[0];
  const count = entries.length;
  const index = selected ? entries.indexOf(selected) : 0;
  const theme = themeFor(army.faction);
  const [moment, setMoment] = useMoment();
  const [showStratagems, setShowStratagems] = useStored("army-cards:play-stratagems", false);
  const [browsing, setBrowsing] = useState(false);
  const rail = useMediaQuery("(min-width: 768px)");
  const [content, width] = useWidth<HTMLDivElement>();
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  // The unit column sticks just under the bar, however tall the bar wraps.
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setBarHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Opens a unit at the top of its sheet. */
  const pick = useCallback(
    (entry: PlayEntry) => {
      onUnitKey(entry.key);
      setBrowsing(false);
      const top = (root.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" });
    },
    [onUnitKey],
  );

  const go = useCallback(
    (step: number) => {
      const next = entries[(index + step + count) % count];
      if (next) pick(next);
    },
    [entries, index, count, pick],
  );

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

  if (!selected) return <p className="text-[14px] text-ink-dim">This list has no units.</p>;

  const pool = selected.stratagems;
  const now = pool.filter((s) => usableNow(s, moment.phase, moment.turn));

  return (
    <div ref={root} className="flex flex-col gap-4">
      <div
        ref={bar}
        className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b border-line bg-panel-strong px-4 py-3 backdrop-blur-sm md:-mx-8 md:px-8"
      >
        <Finder army={army} entries={entries} numbers={numbers} onUnit={pick} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn h-11 w-11 shrink-0 px-0"
            onClick={() => go(-1)}
            aria-label="Previous unit"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setBrowsing(true)}
            disabled={rail}
            className="min-w-0 flex-1 px-1 text-center disabled:cursor-default"
            aria-label={rail ? undefined : "Choose a unit"}
          >
            <span className="micro block">
              Unit {index + 1} / {count}
              {rail ? "" : " · all units ▾"}
            </span>
            <span className="block text-balance text-[18px] font-extrabold uppercase leading-tight tracking-[0.02em] md:text-[20px]">
              {unitLabel(selected.unit, numbers)}
            </span>
            {selected.characters.length ? (
              <span className="block text-[12px] leading-snug text-ink-dim">
                + {selected.characters.map((c) => unitLabel(c, numbers)).join(", ")}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="btn h-11 w-11 shrink-0 px-0"
            onClick={() => go(1)}
            aria-label="Next unit"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        {rail ? (
          <aside
            className="sticky overflow-y-auto overscroll-contain"
            style={{ top: barHeight + 16, maxHeight: `calc(100vh - ${barHeight + 32}px)` }}
            aria-label="Units"
          >
            <UnitList
              entries={entries}
              numbers={numbers}
              selectedKey={selected.key}
              onPick={pick}
            />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col gap-4">
          <section className="bg-panel hairline">
            <button
              type="button"
              onClick={() => setShowStratagems(!showStratagems)}
              aria-expanded={showStratagems}
              className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 text-left"
            >
              <span className="micro text-ink">
                {showStratagems ? "▾" : "▸"} Usable now · {now.length} of {pool.length}
              </span>
              <span className="micro">{momentLabel(moment)}</span>
            </button>
            {showStratagems ? (
              <>
                <div className="border-t border-line px-4 py-3">
                  <MomentPicker moment={moment} onMoment={setMoment} />
                </div>
                <div className="border-t border-line">
                  <StratagemList
                    stratagems={now}
                    empty="Nothing this unit can use in this phase and turn."
                  />
                </div>
              </>
            ) : null}
          </section>

          <div
            ref={content}
            className="flex touch-pan-y flex-col gap-4"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
            {width >= READABLE_CARD_WIDTH ? (
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
      </div>

      {browsing && !rail ? (
        <BottomSheet title="Units" eyebrow={`${count} units`} onClose={() => setBrowsing(false)}>
          <UnitList entries={entries} numbers={numbers} selectedKey={selected.key} onPick={pick} />
        </BottomSheet>
      ) : null}
    </div>
  );
}
