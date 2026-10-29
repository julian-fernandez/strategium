import { useState } from "react";
import { unitLabel } from "../../../shared/labels";
import type { Army, Datasheet, Edit, Swap } from "../../../shared/types";
import { Rich } from "../cards/parts";
import { themeFor } from "../cards/themes";
import { UnitSheet } from "../play/UnitSheet";
import { ArmyRulesPanel } from "../rules/ArmyRulesPanel";
import { AbilityTerm, RuleTerms } from "../rules/Rules";
import { BottomSheet } from "./BottomSheet";
import { WargearOptions, WeaponList } from "./Loadout";
import { useMediaQuery } from "./layout";
import { toRoman } from "./roman";
import { StratagemRows } from "./StratagemRows";

/**
 * The roster as a tile grid, attached units bracketed together. On a desktop
 * the selected unit shows in an inspector beside it, where its wargear can be
 * swapped; on a phone or tablet, tapping a unit opens its datasheet in a sheet
 * over the page.
 */
export function ArmyView({
  army,
  numbers,
  selectedId,
  onSelect,
  onOpenCards,
  onChangeList,
  edits,
  busy,
  notice,
  onEdit,
  onUndo,
  onRevert,
}: {
  army: Army;
  /** "#2" for units that share a name, when numbering is on. */
  numbers: Map<string, number>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenCards: () => void;
  onChangeList: () => void;
  /** How many swaps have been made to the list here. */
  edits: number;
  busy: boolean;
  notice?: string;
  onEdit: (edit: Edit) => void;
  onUndo: () => void;
  onRevert: () => void;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [sheetId, setSheetId] = useState<string>();
  const attachedIds = new Set(army.groups.flatMap((g) => [g.bodyguardId, ...g.characterIds]));
  const others = army.units.filter((unit) => !attachedIds.has(unit.id));
  const selected = army.units.find((unit) => unit.id === selectedId) ?? army.units[0];
  const points = army.units.reduce((sum, unit) => sum + unit.points, 0);
  const sheetUnit = wide ? undefined : army.units.find((unit) => unit.id === sheetId);

  const select = (id: string) => {
    onSelect(id);
    if (!wide) setSheetId(id);
  };
  // A unit's place in the army is its place in the list, which edits name it by.
  const swap = (unit: Datasheet, chosen: Swap) =>
    onEdit({
      unit: army.units.indexOf(unit),
      model: chosen.model,
      toModel: chosen.toModel,
      remove: chosen.remove,
      add: chosen.add,
    });
  const inexact = army.units.some((unit) => !unit.pointsExact);

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="micro">
            {"// "}Roster · {army.units.length} units ·{" "}
            <span
              className="text-ink"
              title={inexact ? "Some units have points rules the app can't read" : undefined}
            >
              {inexact ? "≈" : ""}
              {points.toLocaleString("en")} pts
            </span>
            {army.disposition ? ` · ${army.disposition}` : ""}
          </p>
          {edits ? (
            <div className="flex items-center gap-2">
              <span className="micro text-gold">
                {edits} {edits === 1 ? "change" : "changes"}
              </span>
              <button type="button" className="btn min-h-8 px-3" onClick={onUndo} disabled={busy}>
                Undo
              </button>
              <button type="button" className="btn min-h-8 px-3" onClick={onRevert} disabled={busy}>
                Revert
              </button>
            </div>
          ) : army.note ? (
            <p className="hidden max-w-[50ch] truncate text-[13px] italic text-ink-dim md:block">
              “{army.note}”
            </p>
          ) : null}
          <button type="button" className="btn md:hidden" onClick={onChangeList}>
            Change list
          </button>
        </div>

        {notice ? (
          <p className="border-l-2 border-seal bg-panel px-4 py-3 text-[13px] text-ink-dim">
            {notice}
          </p>
        ) : null}

        <ArmyRulesPanel army={army} />

        {army.groups.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="micro text-ink">Attached units</h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 xl:grid-cols-2">
              {army.groups.map((group) => {
                const members = [...group.characterIds, group.bodyguardId]
                  .map((id) => army.units.find((unit) => unit.id === id))
                  .filter((unit): unit is Datasheet => Boolean(unit));
                return (
                  <div
                    key={group.id}
                    className="relative flex gap-2 border-l border-line-strong pl-4"
                  >
                    <span className="absolute -left-[1px] top-0 h-3 w-3 border-l border-t border-ink" />
                    <span className="absolute -left-[1px] bottom-0 h-3 w-3 border-b border-l border-ink" />
                    <span className="micro absolute -left-3 -top-5 text-ink">
                      {toRoman(group.id)}
                    </span>
                    {members.map((unit) => (
                      <UnitTile
                        key={unit.id}
                        unit={unit}
                        number={numbers.get(unit.id)}
                        selected={unit.id === selected?.id}
                        onSelect={select}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="micro text-ink">Units</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {others.map((unit) => (
              <UnitTile
                key={unit.id}
                unit={unit}
                number={numbers.get(unit.id)}
                selected={unit.id === selected?.id}
                onSelect={select}
              />
            ))}
          </div>
        </section>

        {army.warnings.length ? (
          <section className="border-l-2 border-seal bg-panel px-5 py-4">
            <h2 className="micro text-ink">Needs a look · {army.warnings.length}</h2>
            <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-ink-dim">
              {army.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {wide && selected ? (
        <Inspector
          unit={selected}
          label={unitLabel(selected, numbers)}
          busy={busy}
          onSwap={(chosen) => swap(selected, chosen)}
          onOpenCards={onOpenCards}
        />
      ) : null}

      {sheetUnit ? (
        <BottomSheet title={unitLabel(sheetUnit, numbers)} onClose={() => setSheetId(undefined)}>
          <div className="flex flex-col gap-3">
            <UnitSheet
              unit={sheetUnit}
              characters={[]}
              numbers={numbers}
              theme={themeFor(army.faction)}
            />
            <StratagemRows
              title="Stratagems for this unit"
              count={String(
                army.stratagems.filter((s) => s.usableBy.includes(sheetUnit.name)).length,
              )}
              stratagems={army.stratagems.filter((s) => s.usableBy.includes(sheetUnit.name))}
              empty="No stratagem in this army targets this unit."
            />
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function UnitTile({
  unit,
  number,
  selected,
  onSelect,
}: {
  unit: Datasheet;
  number?: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const role = unit.attachment?.role;
  return (
    <button
      type="button"
      onClick={() => onSelect(unit.id)}
      className={`relative flex min-h-[104px] min-w-0 flex-1 flex-col justify-between bg-panel p-3 pt-4 text-left transition-colors duration-150 ${
        selected
          ? "border border-ink shadow-[inset_0_0_0_3px_var(--color-ground-deep),inset_0_0_0_4px_var(--color-line-strong)]"
          : "hairline hover:border-line-strong"
      }`}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] bg-faction" />
      <span className="text-[14px] font-semibold leading-tight">
        {unit.name}
        {number ? (
          <span className="ml-2 inline-block bg-ink px-1.5 text-[12px] font-bold leading-[18px] text-ground-deep">
            #{number}
          </span>
        ) : null}
      </span>
      {unit.isWarlord || (role && role !== "bodyguard") || unit.warnings.length ? (
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {unit.isWarlord ? <Chip tone="gold">Warlord</Chip> : null}
          {role && role !== "bodyguard" ? <Chip>{role}</Chip> : null}
          {unit.warnings.length ? <Chip tone="seal">Check</Chip> : null}
        </span>
      ) : null}
      <span className="micro mt-3 text-[10px]">
        {unit.modelCount} {unit.modelCount === 1 ? "model" : "models"} · {unit.points} pts
      </span>
    </button>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "gold" | "seal" }) {
  const color =
    tone === "gold"
      ? "border-gold text-gold"
      : tone === "seal"
        ? "border-seal text-seal"
        : "border-line-strong text-ink-dim";
  return (
    <span
      className={`border px-1.5 text-[9px] font-bold uppercase leading-[16px] tracking-[0.16em] ${color}`}
    >
      {children}
    </span>
  );
}

/** Like a Destiny item tooltip: a colored name band, then the numbers. */
function Inspector({
  unit,
  label,
  busy,
  onSwap,
  onOpenCards,
}: {
  unit: Datasheet;
  label: string;
  busy: boolean;
  onSwap: (swap: Swap) => void;
  onOpenCards: () => void;
}) {
  const stats = unit.stats[0];
  return (
    <aside className="flex flex-col lg:sticky lg:top-6">
      <div className="bg-faction px-5 py-4">
        <p className="flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/75">
          <span className="truncate">{unit.keywords.slice(0, 3).join(" · ")}</span>
          <span
            className="shrink-0 text-[13px] tracking-[0.12em] text-ink"
            title={unit.pointsExact ? undefined : "This unit has a points rule the app can't read"}
          >
            {unit.pointsExact ? "" : "≈"}
            {unit.points} pts
          </span>
        </p>
        <h2 className="mt-1 text-[24px] font-extrabold uppercase leading-[1.05] tracking-[0.02em]">
          {label}
        </h2>
      </div>
      <div className="flex flex-col gap-5 bg-panel-strong px-5 py-5 hairline border-t-0">
        {stats ? (
          <div className="grid grid-cols-7 border border-line">
            {(
              [
                ["M", stats.m],
                ["T", stats.t],
                ["Sv", stats.sv],
                ["W", stats.w],
                ["Ld", stats.ld],
                ["OC", stats.oc],
                ["Inv", stats.invSv ?? "–"],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 border-r border-line py-2 last:border-r-0"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-dim">
                  {label}
                </span>
                <span className="text-[17px] font-bold">{value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <WeaponList title="Ranged" rows={unit.ranged} busy={busy} onSwap={onSwap} />
        <WeaponList title="Melee" rows={unit.melee} busy={busy} onSwap={onSwap} />
        <WargearOptions swaps={unit.extras} busy={busy} onSwap={onSwap} />

        <div>
          <p className="micro">{"// "}Abilities</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
            <RuleTerms names={[...unit.coreAbilities, ...unit.factionAbilities]} separator=" · " />
            {unit.abilities.map((ability, index) => (
              <span key={ability.name}>
                {index || unit.coreAbilities.length || unit.factionAbilities.length ? " · " : null}
                <AbilityTerm ability={ability} eyebrow={unit.name} />
              </span>
            ))}
          </p>
          {unit.wargearAbilities.length ? (
            <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
              Wargear:{" "}
              {unit.wargearAbilities.map((ability, index) => (
                <span key={ability.name}>
                  {index ? " · " : null}
                  <AbilityTerm ability={ability} eyebrow="Wargear" />
                </span>
              ))}
            </p>
          ) : null}
          {unit.enhancement ? (
            <p className="mt-2 text-[13px] leading-relaxed">
              <span className="font-semibold text-gold">{unit.enhancement.name}.</span>{" "}
              <span className="text-ink-dim">
                <Rich html={unit.enhancement.html} />
              </span>
            </p>
          ) : null}
        </div>

        {unit.warnings.length ? (
          <ul className="border-l-2 border-seal pl-3 text-[12px] leading-relaxed text-ink-dim">
            {unit.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <button type="button" className="btn w-full" onClick={onOpenCards}>
          See the cards
        </button>
      </div>
    </aside>
  );
}
