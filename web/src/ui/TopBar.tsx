import type { CSSProperties } from "react";
import type { Army } from "../../../shared/types";
import { Emblem } from "../cards/Glyphs";

export type Tab = "army" | "play" | "cards" | "stratagems" | "data";

export const TABS: { id: Tab; label: string }[] = [
  { id: "army", label: "Army" },
  { id: "play", label: "Play" },
  { id: "cards", label: "Cards" },
  { id: "stratagems", label: "Stratagems" },
  { id: "data", label: "Data" },
];

/** On phones the tabs sit at the bottom, within reach of a thumb. */
export function BottomNav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-panel-strong pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      aria-label="Sections"
    >
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTab(item.id)}
          className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
            tab === item.id ? "text-ink" : "text-ink-faint"
          }`}
          aria-current={tab === item.id ? "page" : undefined}
        >
          <span
            className={`h-1.5 w-1.5 rotate-45 ${tab === item.id ? "bg-faction" : "border border-ink-faint"}`}
          />
          {item.label}
          {tab === item.id ? <span className="absolute inset-x-4 top-0 h-[2px] bg-ink" /> : null}
        </button>
      ))}
    </nav>
  );
}

export function TopBar({
  army,
  tab,
  onTab,
  onPrint,
  onChangeList,
  factionColor,
}: {
  army?: Army;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onPrint: () => void;
  onChangeList: () => void;
  factionColor: string;
}) {
  const points = army?.units.reduce((sum, unit) => sum + unit.points, 0) ?? 0;

  return (
    <header
      className="no-print relative border-b border-line bg-panel-strong"
      style={{ "--color-faction": factionColor } as CSSProperties}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-stretch gap-x-6 px-4 md:px-8">
        <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3 py-3 md:basis-[320px] md:gap-4 md:py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-faction md:h-14 md:w-14">
            <Emblem className="h-7 w-7 text-ink md:h-9 md:w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-extrabold uppercase leading-none tracking-[0.04em] md:text-[22px]">
              {army ? army.faction : "Army Cards"}
            </h1>
            <p className="micro mt-2 truncate">
              {army
                ? `// ${army.battleSize?.name ?? "Unknown size"} · ${points.toLocaleString()} pts · ${army.detachments.join(" + ") || "No detachment"}`
                : "// Datasheets for the army you actually brought"}
            </p>
          </div>
        </div>

        {army ? (
          <nav className="ml-auto hidden items-stretch gap-1 md:flex" aria-label="Sections">
            <span className="key-hint self-center">Q</span>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={`relative px-5 text-[13px] font-semibold uppercase tracking-[0.2em] transition-colors duration-150 ${
                  tab === item.id ? "text-ink" : "text-ink-faint hover:text-ink-dim"
                }`}
                aria-current={tab === item.id ? "page" : undefined}
              >
                {item.label}
                {tab === item.id ? (
                  <span className="absolute inset-x-3 bottom-0 h-[2px] bg-ink" />
                ) : null}
              </button>
            ))}
            <span className="key-hint self-center">E</span>
          </nav>
        ) : null}

        {army ? (
          <div className="hidden items-center gap-3 py-4 md:flex">
            <button type="button" className="btn" onClick={onChangeList}>
              Change list
            </button>
            <button type="button" className="btn btn-action" onClick={onPrint}>
              Print
              <span className="key-hint border-white/50 text-white/80">P</span>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
