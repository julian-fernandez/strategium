import { useState } from "react";
import type { Swap, WeaponRow } from "../../../shared/types";

/**
 * A unit's weapons, each opening the swaps one of its models could make: a
 * different choice in its slot, or a different model type with another
 * weapon. What a swap costs or saves is beside it; a swap the unit has no
 * room for says why and can't be picked.
 */
export function WeaponList({
  title,
  rows,
  busy,
  onSwap,
}: {
  title: string;
  rows: WeaponRow[];
  busy: boolean;
  onSwap: (swap: Swap) => void;
}) {
  const [open, setOpen] = useState<string>();
  if (!rows.length) return null;
  return (
    <div>
      <p className="micro">
        {"// "}
        {title}
      </p>
      <ul className="mt-2 flex flex-col">
        {rows.map((row) => {
          const swaps = row.swaps ?? [];
          const isOpen = open === row.name && swaps.length > 0;
          const line = (
            <>
              <span className="w-7 shrink-0 text-right font-bold text-ink">{row.count}×</span>
              <span className="flex-1">
                {row.name}
                {row.carrier ? (
                  <span className="ml-2 border border-line-strong px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {row.carrier}
                  </span>
                ) : null}
              </span>
              <span className="text-[12px] text-ink-dim">
                {row.profiles[0]
                  ? `${row.profiles[0].range} · A${row.profiles[0].attacks} · S${row.profiles[0].strength} · AP${row.profiles[0].ap} · D${row.profiles[0].damage}`
                  : ""}
              </span>
            </>
          );
          return (
            <li key={row.name} className="border-b border-line last:border-b-0">
              {swaps.length ? (
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? undefined : row.name)}
                  aria-expanded={isOpen}
                  className={`group flex w-full items-baseline gap-3 py-1.5 text-left text-[13px] transition-colors duration-150 hover:text-ink ${isOpen ? "text-ink" : ""}`}
                >
                  {line}
                  <SwapIcon
                    className={`h-3 w-3 shrink-0 self-center transition-colors duration-150 ${isOpen ? "text-ink" : "text-ink-faint group-hover:text-ink"}`}
                  />
                </button>
              ) : (
                <div className="flex items-baseline gap-3 py-1.5 pr-6 text-[13px]">{line}</div>
              )}
              {isOpen ? (
                <SwapMenu
                  heading={`Swap one ${row.name}`}
                  swaps={swaps}
                  busy={busy}
                  onSwap={(swap) => {
                    setOpen(undefined);
                    onSwap(swap);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Wargear a model can take or drop that isn't a weapon swap: a Simulacrum, a Null Rod, a Superior's power weapon. */
export function WargearOptions({
  swaps,
  busy,
  onSwap,
}: {
  swaps: Swap[];
  busy: boolean;
  onSwap: (swap: Swap) => void;
}) {
  if (!swaps.length) return null;
  return (
    <div>
      <p className="micro">{"// "}Wargear options</p>
      <SwapMenu swaps={swaps} busy={busy} onSwap={onSwap} describe />
    </div>
  );
}

/** Swaps grouped by the model making them, as a Destiny tooltip lists perks. */
function SwapMenu({
  heading,
  swaps,
  busy,
  onSwap,
  describe = false,
}: {
  heading?: string;
  swaps: Swap[];
  busy: boolean;
  onSwap: (swap: Swap) => void;
  /** Spell out what each swap gives up, for options not opened from a weapon. */
  describe?: boolean;
}) {
  const groups = new Map<string, Swap[]>();
  for (const swap of swaps) {
    const key = `${swap.modelLabel}|${swap.toModel ?? ""}|${swap.blocked ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), swap]);
  }
  return (
    <div className="mb-2 mt-1 flex flex-col gap-3 border-l-2 border-faction bg-ground-deep/70 px-3 py-2.5">
      {heading ? <p className="micro text-ink">{heading}</p> : null}
      {[...groups.values()].map((group) => {
        const [first] = group;
        if (!first) return null;
        return (
          <div key={`${first.modelLabel}|${first.toModel}|${first.blocked}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-dim">
              {first.modelLabel}
              {first.toModel ? (
                <span className="normal-case tracking-normal"> · one becomes {first.toModel}</span>
              ) : null}
            </p>
            {first.blocked ? <p className="mt-0.5 text-[11px] text-seal">{first.blocked}</p> : null}
            <ul className="mt-1 flex flex-col">
              {group.map((swap) => (
                <li key={`${swap.label}|${swap.remove.map((r) => r.name).join("+")}`}>
                  <button
                    type="button"
                    disabled={busy || Boolean(swap.blocked)}
                    onClick={() => onSwap(swap)}
                    className="flex w-full items-baseline gap-3 py-1 text-left text-[13px] transition-colors duration-150 enabled:hover:text-ink disabled:cursor-default disabled:text-ink-faint"
                  >
                    <span className="flex-1">
                      {!swap.add.length ? null : !describe ? (
                        <span className="text-ink-dim">→ </span>
                      ) : swap.remove.length ? (
                        <span className="text-ink-dim">
                          {swap.remove.map((r) => r.name).join(" + ")} →{" "}
                        </span>
                      ) : (
                        <span className="text-ink-dim">+ </span>
                      )}
                      {swap.label}
                    </span>
                    {swap.cost ? (
                      <span
                        className={`shrink-0 text-[12px] font-semibold tabular-nums ${swap.cost > 0 ? "text-gold" : "text-ink-dim"}`}
                      >
                        {swap.cost > 0 ? "+" : "−"}
                        {Math.abs(swap.cost)} pts
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Two opposed arrows: this row can be swapped. */
function SwapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden="true">
      <path
        d="M2 4h8M7.5 1.5 10 4 7.5 6.5M10 8H2M4.5 5.5 2 8l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
