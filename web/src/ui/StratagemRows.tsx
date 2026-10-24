import { useState } from "react";
import type { Stratagem } from "../../../shared/types";
import { Rich } from "../cards/parts";
import { phaseNumeral } from "../cards/StratagemCard";

/**
 * Stratagems as tappable rows for a screen: phase, name, when it's played and
 * CP; tap one for its full text.
 */
export function StratagemRows({
  title,
  count,
  stratagems,
  empty,
  usersOf,
}: {
  title: string;
  /** Shown on the right of the title, e.g. "6 of 15". */
  count?: string;
  stratagems: Stratagem[];
  empty: string;
  /** Who can use each one, for lists that cover several units. */
  usersOf?: (stratagem: Stratagem) => string;
}) {
  const [open, setOpen] = useState<string>();
  return (
    <section className="bg-panel hairline">
      <h3 className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
        <span className="micro text-ink">{title}</span>
        {count ? <span className="micro">{count}</span> : null}
      </h3>
      {stratagems.length ? (
        <ul>
          {stratagems.map((stratagem) => (
            <li key={stratagem.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(open === stratagem.id ? undefined : stratagem.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-expanded={open === stratagem.id}
              >
                <span className="w-9 shrink-0 text-[12px] font-bold text-ink-faint">
                  {phaseNumeral(stratagem.phase)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold uppercase tracking-[0.04em]">
                    {stratagem.name}
                  </span>
                  <span className="block truncate text-[12px] text-ink-dim">
                    {usersOf ? usersOf(stratagem) : stratagem.when}
                  </span>
                </span>
                <span className="shrink-0 bg-faction px-2 py-0.5 text-[12px] font-bold">
                  {stratagem.cp}CP
                </span>
              </button>
              {open === stratagem.id ? (
                <div className="px-4 pb-4 pl-16 text-[14px] leading-relaxed text-ink-dim [&_b]:text-ink">
                  <Rich html={stratagem.html} />
                  <p className="mt-2 text-[12px] text-ink-faint">
                    {stratagem.detachment || "Core"}
                    {stratagem.usableBy.length === 0 ? " · army-wide" : ""}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[13px] text-ink-dim">{empty}</p>
      )}
    </section>
  );
}
