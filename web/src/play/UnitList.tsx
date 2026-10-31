import { useEffect, useRef } from "react";
import { unitLabel } from "../../../shared/labels";
import type { StatLine } from "../../../shared/types";
import type { PlayEntry } from "./playOrder";

/**
 * Every unit to play, in list order, each with the characters leading it and
 * its main stat line, so units compare at a glance. Tap one to open it. The
 * current unit stays in view, so a long list opens where you are.
 */
export function UnitList({
  entries,
  numbers,
  selectedKey,
  onPick,
}: {
  entries: PlayEntry[];
  numbers: Map<string, number>;
  selectedKey?: string;
  onPick: (entry: PlayEntry) => void;
}) {
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selectedKey && current.current) reveal(current.current);
  }, [selectedKey]);

  return (
    <ul className="divide-y divide-line bg-panel hairline">
      {entries.map((entry) => {
        const active = entry.key === selectedKey;
        const stats = entry.unit.stats[0];
        return (
          <li key={entry.key}>
            <button
              ref={active ? current : undefined}
              type="button"
              onClick={() => onPick(entry)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors duration-150 ${
                active
                  ? "bg-panel-strong shadow-[inset_3px_0_0_var(--color-faction)]"
                  : "hover:bg-panel-strong"
              }`}
            >
              <span className="text-[14px] font-semibold leading-snug">
                {unitLabel(entry.unit, numbers)}
              </span>
              {entry.characters.length ? (
                <span className="text-[12px] leading-snug text-ink-dim">
                  + {entry.characters.map((c) => unitLabel(c, numbers)).join(", ")}
                </span>
              ) : null}
              {stats ? <MiniStats line={stats} /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Scrolls the list's own box (the tablet column, or the sheet) to show an
 * item. scrollIntoView would move the whole page too when the column runs
 * past the bottom of the screen.
 */
function reveal(item: HTMLElement): void {
  let box = item.parentElement;
  while (
    box &&
    !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))
  ) {
    box = box.parentElement;
  }
  if (!box) return;
  const shown = box.getBoundingClientRect();
  const place = item.getBoundingClientRect();
  if (place.top < shown.top) box.scrollTop -= shown.top - place.top;
  else if (place.bottom > shown.bottom) box.scrollTop += place.bottom - shown.bottom;
}

function MiniStats({ line }: { line: StatLine }) {
  const fields: [string, string | undefined][] = [
    ["M", line.m],
    ["T", line.t],
    ["Sv", line.sv],
    ["W", line.w],
    ["OC", line.oc],
    ["Inv", line.invSv],
  ];
  return (
    <span className="flex flex-wrap gap-x-2.5 text-[11px] tabular-nums text-ink-faint">
      {fields.map(([label, value]) =>
        value ? (
          <span key={label}>
            {label} <span className="font-semibold text-ink-dim">{value}</span>
          </span>
        ) : null,
      )}
    </span>
  );
}
