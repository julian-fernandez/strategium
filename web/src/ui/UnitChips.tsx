/** Units as small buttons under a rule or stratagem, each opening that unit in Play. */
export function UnitChips({
  title,
  units,
  onPick,
}: {
  /** A micro label before the buttons, e.g. "Has it". */
  title?: string;
  units: { key: string; label: string }[];
  onPick: (key: string) => void;
}) {
  if (!units.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {title ? <span className="micro mr-1">{title}</span> : null}
      {units.map((unit) => (
        <button
          key={unit.key}
          type="button"
          onClick={() => onPick(unit.key)}
          className="border border-line-strong px-2.5 py-1.5 text-[12px] font-semibold text-ink transition-colors duration-150 hover:bg-panel-strong"
        >
          {unit.label} ›
        </button>
      ))}
    </div>
  );
}
