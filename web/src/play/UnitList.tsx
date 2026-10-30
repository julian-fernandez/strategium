import { unitLabel } from "../../../shared/labels";
import type { StatLine } from "../../../shared/types";
import type { PlayEntry } from "./playOrder";

/**
 * Every unit to play, in list order, each with the characters leading it and
 * its main stat line, so units compare at a glance. Tap one to open it.
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
  return (
    <ul className="divide-y divide-line bg-panel hairline">
      {entries.map((entry) => {
        const active = entry.key === selectedKey;
        const stats = entry.unit.stats[0];
        return (
          <li key={entry.key}>
            <button
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
