import type { CSSProperties } from "react";
import type { Datasheet, StatLine, WeaponRow } from "../../../shared/types";
import { AbilityList, CarrierTag, Rich, SectionBar, splitName } from "../cards/parts";
import type { CardTheme } from "../cards/themes";
import { RuleTerms } from "../rules/Rules";

/**
 * A datasheet reflowed for a phone: the printed card's look (paper, faction
 * header, white stat boxes, dark section bars) stacked in one readable column.
 * Characters leading the unit follow it, as they would on the card's back.
 */
export function UnitSheet({
  unit,
  characters,
  numbers,
  theme,
}: {
  unit: Datasheet;
  characters: Datasheet[];
  numbers: Map<string, number>;
  theme: CardTheme;
}) {
  const keywords = [...new Set([unit, ...characters].flatMap((sheet) => sheet.keywords))];
  const factionKeywords = [...new Set([unit, ...characters].flatMap((s) => s.factionKeywords))];

  return (
    <article
      className="overflow-hidden rounded-[6px] bg-paper font-card text-[14px] text-card-ink"
      style={{ "--accent": theme.accent } as CSSProperties}
    >
      <SheetSection sheet={unit} number={numbers.get(unit.id)} theme={theme} />
      {characters.map((character) => (
        <SheetSection
          key={character.id}
          sheet={character}
          number={numbers.get(character.id)}
          theme={theme}
          ledUnit={unit.name}
        />
      ))}
      <footer className="bg-card-footer px-4 py-3 font-condensed text-[12px] uppercase leading-snug text-white">
        <p>
          <span className="font-bold text-white/70">Keywords: </span>
          {keywords.join("; ")}
        </p>
        <p className="mt-1">
          <span className="font-bold text-white/70">Faction: </span>
          {factionKeywords.join(", ")}
        </p>
      </footer>
    </article>
  );
}

function SheetSection({
  sheet,
  number,
  theme,
  ledUnit,
}: {
  sheet: Datasheet;
  number?: number;
  theme: CardTheme;
  /** Set for a character leading this unit. */
  ledUnit?: string;
}) {
  const [title, suffix] = splitName(sheet.name);
  const role = sheet.attachment?.role === "support" ? "Support" : "Leader";

  return (
    <section>
      <header className="px-4 pb-4 pt-3 text-white" style={{ backgroundColor: theme.header }}>
        <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-white/75">
          {ledUnit
            ? `${role} of ${ledUnit}${sheet.isWarlord ? " · Warlord" : ""}`
            : `${sheet.modelCount} ${sheet.modelCount === 1 ? "model" : "models"} · ${sheet.points} pts${sheet.isWarlord ? " · Warlord" : ""}`}
        </p>
        <h2 className="font-condensed text-[26px] font-extrabold uppercase leading-none">
          {title}
          {suffix ? <span className="ml-2 text-[15px] font-bold">{suffix}</span> : null}
          {number ? (
            <span className="ml-2 inline-block rounded-[3px] bg-white px-1.5 align-[3px] text-[18px] text-[#2b2b29]">
              #{number}
            </span>
          ) : null}
        </h2>
        <Stats stats={sheet.stats} />
      </header>

      <div className="flex flex-col gap-3 px-3 py-3">
        <Weapons rows={sheet.ranged} melee={false} />
        <Weapons rows={sheet.melee} melee />

        <div>
          <SectionBar title="Abilities" />
          <div className="px-1 pt-1">
            {sheet.coreAbilities.length ? (
              <p className="mt-1.5">
                <b className="uppercase">Core:</b> <RuleTerms names={sheet.coreAbilities} />
              </p>
            ) : null}
            {sheet.factionAbilities.length ? (
              <p className="mt-1.5">
                <b className="uppercase">Faction:</b> <RuleTerms names={sheet.factionAbilities} />
              </p>
            ) : null}
            <AbilityList abilities={sheet.abilities} />
            {sheet.wargearAbilities.length ? (
              <AbilityList abilities={sheet.wargearAbilities} />
            ) : null}
            {sheet.enhancement ? (
              <AbilityList
                abilities={[
                  { ...sheet.enhancement, name: `Enhancement · ${sheet.enhancement.name}` },
                ]}
              />
            ) : null}
          </div>
        </div>

        {sheet.attachTo && !ledUnit ? (
          <div>
            <SectionBar title={sheet.attachTo.title} />
            <p className="px-1 pt-1.5 leading-snug">
              <Rich html={sheet.attachTo.html} />
            </p>
          </div>
        ) : null}

        {ledUnit ? null : (
          <p className="px-1 text-[13px] text-[#4a4a44]">
            {sheet.models.map((model) => `${model.count} ${model.name}`).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

const STAT_FIELDS = [
  ["M", "m"],
  ["T", "t"],
  ["SV", "sv"],
  ["W", "w"],
  ["LD", "ld"],
  ["OC", "oc"],
] as const;

function Stats({ stats }: { stats: StatLine[] }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {stats.map((line) => (
        <div key={line.name}>
          {stats.length > 1 ? (
            <p className="mb-1 text-[11px] font-semibold uppercase text-white/80">{line.name}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {STAT_FIELDS.map(([label, key]) => (
              <Stat key={key} label={label} value={line[key]} />
            ))}
            {line.invSv ? <Stat label="InSv" value={line.invSv} shield /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, shield }: { label: string; value: string; shield?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-condensed text-[11px] font-bold uppercase text-white/85">{label}</span>
      <span
        className={`flex h-9 w-9 items-center justify-center bg-white font-condensed text-[17px] font-extrabold text-[#2b2b29] min-[380px]:h-10 min-[380px]:w-10 min-[380px]:text-[19px] ${
          shield ? "rounded-b-[14px] rounded-t-[4px]" : "rounded-[5px]"
        }`}
      >
        {value || "–"}
      </span>
    </div>
  );
}

function Weapons({ rows, melee }: { rows: WeaponRow[]; melee: boolean }) {
  if (!rows.length) return null;
  const columns = ["Range", "A", melee ? "WS" : "BS", "S", "AP", "D"];
  return (
    <div>
      <SectionBar title={melee ? "Melee weapons" : "Ranged weapons"} />
      {rows.map((row) => (
        <div key={row.name} className="border-b border-paper-rule px-1 py-2">
          <p className="font-semibold leading-tight">
            <span className="mr-1.5 font-condensed font-extrabold text-[var(--accent)]">
              {row.count}×
            </span>
            {row.name}
            <CarrierTag carrier={row.carrier} />
          </p>
          {row.profiles.map((profile) => (
            <div key={profile.name} className="mt-1">
              {row.profiles.length > 1 ? (
                <p className="text-[13px] text-[#4a4a44]">{profile.name}</p>
              ) : null}
              {profile.keywords.length ? (
                <p className="font-condensed text-[12px] font-bold uppercase text-[#4a4a44]">
                  [<RuleTerms names={profile.keywords} />]
                </p>
              ) : null}
              <dl className="mt-1 grid grid-cols-6 text-center">
                {[
                  profile.range,
                  profile.attacks,
                  profile.skill,
                  profile.strength,
                  profile.ap,
                  profile.damage,
                ].map((value, index) => (
                  <div key={columns[index]}>
                    <dt className="font-condensed text-[11px] font-bold uppercase text-[#6a6a62]">
                      {columns[index]}
                    </dt>
                    <dd className="font-semibold">{value || "–"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
