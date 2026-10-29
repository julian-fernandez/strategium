import type { Army, Datasheet, Stratagem } from "../../../shared/types";
import { playEntries } from "../play/playOrder";
import { UnitSheet } from "../play/UnitSheet";
import { ArmyRulesPanel } from "../rules/ArmyRulesPanel";
import { FitToWidth } from "../ui/FitToWidth";
import { StratagemRows } from "../ui/StratagemRows";
import { Rich } from "./parts";
import type { DeckOptions } from "./printOrder";
import { StratagemCard } from "./StratagemCard";
import { themeFor } from "./themes";

/**
 * The deck for a phone screen, where an A5 card would be too small to read:
 * the army rules, each unit's datasheet reflowed and followed by what its
 * card's back would hold, the stratagem deck, then the rules reference.
 */
export function ReadableDeck({
  army,
  options,
  numbers,
  fontsReady,
}: {
  army: Army;
  options: DeckOptions;
  numbers: Map<string, number>;
  fontsReady: boolean;
}) {
  const theme = themeFor(army.faction);
  const cards: {
    key: string;
    unit: Datasheet;
    characters: Datasheet[];
    stratagems: Stratagem[];
  }[] = options.leadersOnBack
    ? playEntries(army).map((entry) => ({
        ...entry,
        // Army-wide stratagems (New Orders) aren't on any unit's card.
        stratagems: entry.stratagems.filter((s) => s.usableBy.length),
      }))
    : army.units.map((unit) => ({
        key: unit.id,
        unit,
        characters: [],
        stratagems: army.stratagems.filter((s) => s.usableBy.includes(unit.name)),
      }));

  return (
    <div className="flex flex-col gap-8">
      <p className="text-[13px] leading-relaxed text-ink-dim">
        Shown for reading on this screen. Print from a computer for the A5 cards.
      </p>
      {options.armyRules ? <ArmyRulesPanel army={army} /> : null}
      {cards.map((card) => (
        <section key={card.key} className="flex flex-col gap-3">
          <UnitSheet
            unit={card.unit}
            characters={card.characters}
            numbers={numbers}
            theme={theme}
          />
          {options.unitStratagems && card.stratagems.length ? (
            <StratagemRows
              title="Stratagems for this unit"
              count={String(card.stratagems.length)}
              stratagems={card.stratagems}
              empty=""
            />
          ) : null}
        </section>
      ))}
      {options.stratagems ? (
        <section className="flex flex-col gap-3">
          <h2 className="micro text-ink">
            {"// "}Stratagem deck · {army.stratagems.length}
          </h2>
          {army.stratagems.map((stratagem) => (
            <FitToWidth key={stratagem.id}>
              <StratagemCard stratagem={stratagem} theme={theme} fontsReady={fontsReady} />
            </FitToWidth>
          ))}
        </section>
      ) : null}
      {options.glossary && army.glossary.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="micro text-ink">
            {"// "}Rules reference · {army.glossary.length}
          </h2>
          <div className="divide-y divide-line bg-panel hairline">
            {army.glossary.map((rule) => (
              <article key={rule.name} className="px-4 py-3">
                <h3 className="text-[13px] font-extrabold uppercase tracking-[0.06em]">
                  {rule.name}
                </h3>
                <div className="rules-text mt-1 text-[13px] leading-relaxed text-ink-dim">
                  <Rich html={rule.html} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
