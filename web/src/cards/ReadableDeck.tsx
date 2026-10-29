import type { Army, Datasheet } from "../../../shared/types";
import { playEntries } from "../play/playOrder";
import { UnitSheet } from "../play/UnitSheet";
import { ArmyRulesPanel } from "../rules/ArmyRulesPanel";
import { FitToWidth } from "../ui/FitToWidth";
import { Rich } from "./parts";
import type { DeckOptions } from "./printOrder";
import { StratagemCard } from "./StratagemCard";
import { themeFor } from "./themes";

/**
 * The deck for a phone screen, where an A5 card would be too small to read:
 * the army rules, each unit's datasheet reflowed (with the characters leading
 * it), the stratagem deck, then the rules reference.
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
  const cards: { key: string; unit: Datasheet; characters: Datasheet[] }[] = options.leadersOnBack
    ? playEntries(army)
    : army.units.map((unit) => ({ key: unit.id, unit, characters: [] }));

  return (
    <div className="flex flex-col gap-8">
      <p className="text-[13px] leading-relaxed text-ink-dim">
        Shown for reading on this screen. Print from a computer for the A5 cards.
      </p>
      {options.armyRules ? <ArmyRulesPanel army={army} /> : null}
      {cards.map((card) => (
        <UnitSheet
          key={card.key}
          unit={card.unit}
          characters={card.characters}
          numbers={numbers}
          theme={theme}
        />
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
