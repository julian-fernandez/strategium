import type { CSSProperties } from "react";
import type { Army } from "../../../shared/types";
import { Emblem } from "../cards/Glyphs";

export type Tab = "army" | "cards" | "stratagems" | "data";

export const TABS: { id: Tab; label: string }[] = [
  { id: "army", label: "Army" },
  { id: "cards", label: "Cards" },
  { id: "stratagems", label: "Stratagems" },
  { id: "data", label: "Data" },
];

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
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-stretch gap-x-6 px-8">
        <div className="flex min-w-0 flex-1 basis-[320px] items-center gap-4 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-faction">
            <Emblem className="h-9 w-9 text-ink" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-extrabold uppercase leading-none tracking-[0.04em]">
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
          <nav className="ml-auto flex items-stretch gap-1" aria-label="Sections">
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
          <div className="flex items-center gap-3 py-4">
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
