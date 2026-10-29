import { unitLabel } from "../../../shared/labels";
import type { Datasheet, Stratagem } from "../../../shared/types";
import { CardShell, SIDE_WIDTHS, UnitNumber } from "./DatasheetCard";
import { Emblem } from "./Glyphs";
import { AbilityList, SectionBar, StatBadges, WeaponTable } from "./parts";
import { StratagemList } from "./StratagemList";
import type { CardTheme } from "./themes";
import { useFitText } from "./useFitText";

/**
 * The back of a bodyguard unit's card: the characters attached to it, and the
 * stratagems the combined unit can use.
 */
export function LeaderBackCard({
  bodyguard,
  characters,
  stratagems,
  numbers,
  theme,
  fontsReady,
}: {
  bodyguard: Datasheet;
  characters: Datasheet[];
  stratagems: Stratagem[];
  numbers: Map<string, number>;
  theme: CardTheme;
  fontsReady: boolean;
}) {
  const body = useFitText<HTMLDivElement>(7.2, 5, bodyguard, fontsReady, SIDE_WIDTHS);
  const keywords = [...new Set(characters.flatMap((c) => c.keywords))];
  const factionKeywords = [...new Set(characters.flatMap((c) => c.factionKeywords))];

  return (
    <CardShell
      theme={theme}
      keywords={keywords}
      factionKeywords={factionKeywords}
      header={
        <div className="relative z-10 flex w-full items-center gap-[5mm] px-[4mm]">
          <div className="min-w-0 flex-1">
            <p className="font-condensed text-[7pt] font-bold uppercase tracking-[0.18em] text-white/75">
              Attached to {unitLabel(bodyguard, numbers)}
            </p>
            {characters.map((character) => (
              <h2
                key={character.id}
                className="font-condensed text-[17pt] font-extrabold uppercase leading-none"
              >
                {character.name}
                {numbers.get(character.id) ? (
                  <UnitNumber value={numbers.get(character.id) ?? 0} />
                ) : null}
                <span className="ml-[2mm] align-middle text-[7pt] font-bold tracking-[0.12em] text-white/75">
                  {character.attachment?.role === "support" ? "Support" : "Leader"}
                  {character.isWarlord ? " · Warlord" : ""}
                </span>
              </h2>
            ))}
          </div>
          <Emblem className="h-[24mm] w-[24mm] shrink-0 text-white/25" />
        </div>
      }
    >
      <div
        ref={body}
        className="grid min-h-0 flex-1 grid-cols-[1fr_var(--side,68mm)] gap-[2.5mm] overflow-hidden p-[2.5mm]"
        style={{ fontSize: "calc(var(--fit) * 1pt)" }}
      >
        <div data-fit-column className="flex min-h-0 flex-col gap-[2mm] overflow-hidden">
          {characters.map((character) => (
            <div key={character.id} className="flex flex-col gap-[1.2mm]">
              <div
                className="flex items-center gap-[3mm] px-[1.6mm] py-[1.2mm] text-white"
                style={{ backgroundColor: theme.header }}
              >
                <span className="font-condensed text-[1.25em] font-extrabold uppercase">
                  {character.name}
                </span>
                <StatBadges stats={character.stats} size="small" />
              </div>
              <WeaponTable rows={character.ranged} melee={false} />
              <WeaponTable rows={character.melee} melee />
            </div>
          ))}
          <StratagemList stratagems={stratagems} />
        </div>
        <div
          data-fit-column
          className="flex min-h-0 flex-col gap-[1.5mm] overflow-hidden border-l border-paper-rule pl-[2.5mm]"
        >
          {characters.map((character) => (
            <div key={character.id}>
              <SectionBar title={`${character.name} · abilities`} />
              <div className="px-[1.6mm] pb-[1mm]">
                {character.coreAbilities.length ? (
                  <p className="mt-[0.9mm]">
                    <b className="uppercase">Core:</b> {character.coreAbilities.join(", ")}
                  </p>
                ) : null}
                {character.factionAbilities.length ? (
                  <p className="mt-[0.9mm]">
                    <b className="uppercase">Faction:</b> {character.factionAbilities.join(", ")}
                  </p>
                ) : null}
                <AbilityList abilities={character.abilities} />
                <AbilityList abilities={character.wargearAbilities} />
                {character.enhancement ? (
                  <AbilityList
                    abilities={[
                      {
                        ...character.enhancement,
                        name: `Enhancement · ${character.enhancement.name}`,
                      },
                    ]}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
