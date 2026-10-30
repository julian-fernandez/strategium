import { useState } from "react";
import type { Stratagem } from "../../../shared/types";
import { Rich } from "../cards/parts";
import { phaseNumeral } from "../cards/StratagemCard";

/**
 * Stratagems as tappable rows for a screen, under a title: phase, name, when
 * it's played and CP; tap one for its full text.
 */
export function StratagemRows({
  title,
  count,
  stratagems,
  empty,
}: {
  title: string;
  /** Shown on the right of the title, e.g. "6 of 15". */
  count?: string;
  stratagems: Stratagem[];
  empty: string;
}) {
  return (
    <section className="bg-panel hairline">
      <h3 className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
        <span className="micro text-ink">{title}</span>
        {count ? <span className="micro">{count}</span> : null}
      </h3>
      <StratagemList stratagems={stratagems} empty={empty} />
    </section>
  );
}

/** The rows alone, for a panel that has its own header. */
export function StratagemList({ stratagems, empty }: { stratagems: Stratagem[]; empty: string }) {
  const [open, setOpen] = useState<string>();
  if (!stratagems.length) return <p className="px-4 py-3 text-[13px] text-ink-dim">{empty}</p>;
  return (
    <ul>
      {stratagems.map((stratagem) => (
        <li key={stratagem.id} className="border-b border-line last:border-b-0">
          <button
            type="button"
            onClick={() => setOpen(open === stratagem.id ? undefined : stratagem.id)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left"
            aria-expanded={open === stratagem.id}
          >
            <span className="mt-0.5 w-9 shrink-0 text-[12px] font-bold text-ink-faint">
              {phaseNumeral(stratagem.phase)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold uppercase leading-snug tracking-[0.04em]">
                {stratagem.name}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-dim">
                {stratagem.when}
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
                {stratagem.detachment || "Core"} · {usableBy(stratagem)}
              </p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function usableBy(stratagem: Stratagem): string {
  if (stratagem.everyUnit) return "every unit";
  if (stratagem.usableBy.length === 0) return "army-wide";
  return `for ${stratagem.usableBy.join(", ")}`;
}
