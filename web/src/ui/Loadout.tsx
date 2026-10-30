import { useState } from "react";
import type { Counted, LoadoutPick, LoadoutRow, Swap, WeaponRow } from "../../../shared/types";

/** A unit's weapons with their profiles, for reading. Changing them is the loadout's job. */
export function WeaponList({ title, rows }: { title: string; rows: WeaponRow[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="micro">
        {"// "}
        {title}
      </p>
      <ul className="mt-2 flex flex-col">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-baseline gap-3 border-b border-line py-1.5 text-[13px] last:border-b-0"
          >
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
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What's open: one pick of one row, or a row's "give a trooper one". */
type Open = { row: string; pick?: number };

/**
 * The squad by its models: who, how many, what they carry. The wargear they
 * chose are buttons; each opens what one of them (or all of them) could take
 * instead, with what that costs. A specialist row ("Special Weapon 3 of 4")
 * offers to give a trooper one while there's room.
 */
export function LoadoutEditor({
  rows,
  busy,
  lastChange,
  onSwap,
  onUndo,
}: {
  rows: LoadoutRow[];
  busy: boolean;
  /** What the last swap did to this unit, said back with a way to undo it. */
  lastChange?: string;
  onSwap: (swap: Swap, times: number) => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState<Open>();
  const editable = rows.some((row) => row.picks.length || row.joins.length);
  if (!editable) return null;
  const single = rows.length === 1;
  const isOpen = (row: LoadoutRow, pick?: number) => open?.row === row.model && open.pick === pick;
  const toggle = (row: LoadoutRow, pick?: number) =>
    setOpen(isOpen(row, pick) ? undefined : { row: row.model, pick });
  const choose = (swap: Swap, times: number) => {
    setOpen(undefined);
    onSwap(swap, times);
  };

  return (
    <div>
      <p className="micro">{"// "}Loadout</p>
      {lastChange ? (
        <p className="mt-2 flex items-baseline gap-3 border-l-2 border-gold bg-panel px-3 py-2 text-[12px]">
          <span className="flex-1 text-ink">{lastChange}</span>
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim transition-colors duration-150 hover:text-ink"
          >
            Undo
          </button>
        </p>
      ) : (
        <p className="mt-1 text-[12px] text-ink-dim">Click a piece of wargear to change it.</p>
      )}
      <div className="mt-2 flex flex-col">
        {rows.map((row) => (
          <section key={row.model} className="border-t border-line py-2.5 first:border-t-0">
            {single ? null : (
              <header className="flex items-baseline justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
                  {row.label}
                </h3>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${row.max && row.count >= row.max ? "text-gold" : "text-ink-dim"}`}
                >
                  {row.max ? `${row.count} of ${row.max}` : `×${row.count}`}
                </span>
              </header>
            )}
            {row.count > 0 && row.picks.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.picks.map((pick, index) => (
                  <Chip
                    key={`${pick.slot}|${pick.name}`}
                    open={isOpen(row, index)}
                    dashed={!pick.name}
                    onClick={() => toggle(row, index)}
                  >
                    {pick.name || `+ ${optional(pick)}`}
                    {pick.count > 1 && row.count > 1 ? (
                      <span className="text-ink-dim">×{pick.count}</span>
                    ) : null}
                  </Chip>
                ))}
              </div>
            ) : null}
            {row.count > 0 && row.fixed.length ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-dim">{names(row.fixed)}</p>
            ) : null}
            {row.full ? (
              <p className="mt-1.5 text-[11px] text-ink-dim">{row.full}</p>
            ) : row.joins.length ? (
              <div className="mt-2">
                <Chip open={isOpen(row)} dashed onClick={() => toggle(row)}>
                  + Give {article(row.joins[0]?.modelLabel ?? "")} one
                </Chip>
              </div>
            ) : null}

            {row.picks.map((pick, index) =>
              isOpen(row, index) ? (
                <Menu
                  key={`${pick.slot}|${pick.name}`}
                  title={
                    pick.name
                      ? `Instead of ${pick.name}`
                      : `${single ? "May" : `${row.label} may`} also take`
                  }
                  swaps={pick.swaps}
                  holders={pick.name ? pick.count : 1}
                  busy={busy}
                  onChoose={choose}
                />
              ) : null,
            )}
            {isOpen(row) ? (
              <Menu
                title={`Give one ${row.joins[0]?.modelLabel}`}
                swaps={row.joins}
                holders={1}
                busy={busy}
                onChoose={choose}
              />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

/** The choices for one pick, applied to one model or, when several hold it, to all of them. */
function Menu({
  title,
  swaps,
  holders,
  busy,
  onChoose,
}: {
  title: string;
  swaps: Swap[];
  holders: number;
  busy: boolean;
  onChoose: (swap: Swap, times: number) => void;
}) {
  const [all, setAll] = useState(false);
  const times = all ? holders : 1;
  return (
    <div className="mt-2 border-l-2 border-faction bg-ground-deep/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="micro text-ink">{title}</p>
        {holders > 1 ? (
          <div className="flex border border-line-strong text-[10px] font-semibold uppercase tracking-[0.14em]">
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setAll(value)}
                aria-pressed={all === value}
                className={`whitespace-nowrap px-2 py-0.5 transition-colors duration-150 ${all === value ? "bg-ink text-ground-deep" : "text-ink-dim hover:text-ink"}`}
              >
                {value ? `All ${holders}` : "One"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ul className="mt-1.5 flex flex-col">
        {swaps.map((swap) => {
          const blocked = swap.blocked;
          return (
            <li key={`${swap.label}|${swap.toModel ?? ""}`}>
              <button
                type="button"
                disabled={busy || Boolean(blocked)}
                onClick={() => onChoose(swap, times)}
                className="flex w-full items-baseline gap-3 py-1 text-left text-[13px] transition-colors duration-150 enabled:hover:text-ink disabled:cursor-default disabled:text-ink-faint"
              >
                <span className="flex-1">
                  {swap.label}
                  {swap.toLabel && !swap.label.includes(swap.toLabel) ? (
                    <span className="text-[12px] text-ink-dim"> · as {article(swap.toLabel)}</span>
                  ) : null}
                  {blocked ? <span className="block text-[11px] text-seal">{blocked}</span> : null}
                </span>
                {swap.cost ? (
                  <span
                    className={`shrink-0 text-[12px] font-semibold tabular-nums ${swap.cost > 0 ? "text-gold" : "text-ink-dim"}`}
                  >
                    {swap.cost > 0 ? "+" : "−"}
                    {Math.abs(swap.cost * times)} pts
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A piece of wargear that opens its choices: a framed tile, as Destiny's item slots are. */
function Chip({
  children,
  open,
  dashed = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  open: boolean;
  dashed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-left text-[12px] font-semibold transition-colors duration-150 disabled:cursor-default disabled:text-ink-faint ${dashed ? "border-dashed" : ""} ${
        open
          ? "border-ink bg-ground-raised text-ink"
          : "border-line-strong bg-panel text-ink enabled:hover:border-ink"
      }`}
    >
      {children}
      {disabled ? null : (
        <svg
          viewBox="0 0 8 8"
          className={`h-2 w-2 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M1 2.5 4 5.5 7 2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
    </button>
  );
}

/** An empty optional slot, by what could fill it: "Chainsword or Power weapon". */
function optional(pick: LoadoutPick): string {
  const labels = pick.swaps.map((swap) => swap.label);
  return labels.length <= 2 ? labels.join(" or ") : "Optional wargear";
}

function names(items: Counted[]): string {
  return items
    .map((item) => (item.count > 1 ? `${item.count}× ${item.name}` : item.name))
    .join(" · ");
}

function article(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
