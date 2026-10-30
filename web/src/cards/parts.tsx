import type { ReactNode } from "react";
import type { Ability, Datasheet, StatLine, WeaponRow } from "../../../shared/types";
import { RuleTerms } from "../rules/Rules";
import { BladesIcon, CrosshairIcon, ShieldShape } from "./Glyphs";

const STAT_FIELDS = [
  ["M", "m"],
  ["T", "t"],
  ["SV", "sv"],
  ["W", "w"],
  ["LD", "ld"],
  ["OC", "oc"],
] as const;

/**
 * The white stat boxes. On the full header the invulnerable save shield sits
 * under SV, like the official card; the small version keeps it on the same
 * line to save height on the leader backs.
 */
export function StatBadges({
  stats,
  size = "full",
}: {
  stats: StatLine[];
  size?: "full" | "small";
}) {
  const height = size === "full" ? "h-[9mm]" : "h-[6mm]";
  const box = size === "full" ? `${height} w-[9mm] text-[13pt]` : `${height} w-[6.4mm] text-[9pt]`;
  const label = size === "full" ? "text-[6.5pt]" : "text-[5pt]";
  const multiple = stats.length > 1;
  const inline = multiple || size === "small";

  return (
    <div className="flex flex-col gap-[1.2mm]">
      {stats.map((line, index) => (
        <div key={line.name} className="flex items-end gap-[1.6mm]">
          {multiple ? (
            // As tall as the boxes and level with them: the first row's column titles sit above both.
            <div
              className={`${height} flex w-[16mm] items-center text-[6pt] font-semibold uppercase leading-tight text-white/90`}
            >
              {line.name}
            </div>
          ) : null}
          {STAT_FIELDS.map(([title, key]) => (
            <div key={key} className="flex flex-col items-center gap-[0.6mm]">
              {index === 0 ? (
                <span className={`${label} font-condensed font-bold text-white/90`}>{title}</span>
              ) : null}
              <span
                className={`${box} flex items-center justify-center rounded-[1.2mm] bg-white font-condensed font-extrabold text-[#2b2b29]`}
              >
                {line[key] || "–"}
              </span>
            </div>
          ))}
          {inline && line.invSv ? <InvulnShield value={line.invSv} size={size} /> : null}
        </div>
      ))}
      {!inline && stats[0]?.invSv ? (
        // Under the SV box, like the official card.
        <div className={size === "full" ? "pl-[21.2mm]" : "pl-[14.4mm]"}>
          <InvulnShield value={stats[0].invSv} size={size} />
        </div>
      ) : null}
    </div>
  );
}

function InvulnShield({ value, size }: { value: string; size: "full" | "small" }) {
  const shield =
    size === "full" ? "h-[8.5mm] w-[8mm] text-[10pt]" : "h-[6mm] w-[5.6mm] text-[7.5pt]";
  return (
    <div className="flex items-center gap-[1mm]">
      <span className={`relative flex items-center justify-center ${shield}`}>
        <ShieldShape className="absolute inset-0 h-full w-full text-white" />
        <span className="relative font-condensed font-extrabold text-[#2b2b29]">{value}</span>
      </span>
      <span className="font-condensed text-[6pt] font-bold uppercase text-white/90">InSv</span>
    </div>
  );
}

/**
 * Weapon table column widths. They scale with the card's `--fit` size rather
 * than `em`, so the bar's labels and the rows' values line up.
 */
const RANGE_COLUMN = "w-[calc(var(--fit)*3.6pt)]";
const STAT_COLUMN = "w-[calc(var(--fit)*2.5pt)]";

/** A dark section bar: RANGED WEAPONS, ABILITIES, UNIT COMPOSITION… */
export function SectionBar({
  title,
  icon,
  columns,
}: {
  title: string;
  icon?: ReactNode;
  columns?: string[];
}) {
  return (
    <div className="flex items-center bg-card-bar px-[1.6mm] py-[0.7mm] font-condensed text-[1.05em] font-bold uppercase tracking-[0.04em] text-white">
      {icon ? <span className="mr-[1.2mm] h-[1.1em] w-[1.1em]">{icon}</span> : null}
      <span className="flex-1">{title}</span>
      {columns?.map((column, index) => (
        <span key={column} className={`${index === 0 ? RANGE_COLUMN : STAT_COLUMN} text-center`}>
          {column}
        </span>
      ))}
    </div>
  );
}

export function WeaponTable({ rows, melee }: { rows: WeaponRow[]; melee: boolean }) {
  if (rows.length === 0) return null;
  const columns = ["Range", "A", melee ? "WS" : "BS", "S", "AP", "D"];
  return (
    <div>
      <SectionBar
        title={melee ? "Melee weapons" : "Ranged weapons"}
        icon={
          melee ? (
            <BladesIcon className="h-full w-full" />
          ) : (
            <CrosshairIcon className="h-full w-full" />
          )
        }
        columns={columns}
      />
      {rows.map((row) => (
        <div key={row.name} className="border-b border-paper-rule">
          {row.profiles.length > 1 ? (
            <div className="px-[1.6mm] pt-[0.6mm] font-semibold">
              <Count value={row.count} />
              {row.name}
              <CarrierTag carrier={row.carrier} />
            </div>
          ) : null}
          {row.profiles.map((profile) => (
            <div key={profile.name} className="flex items-baseline px-[1.6mm] py-[0.55mm]">
              <span className="flex-1 leading-tight">
                {row.profiles.length === 1 ? <Count value={row.count} /> : null}
                <span className={row.profiles.length > 1 ? "pl-[1.5mm]" : "font-semibold"}>
                  {row.profiles.length > 1 ? profile.name : row.name}
                </span>
                {row.profiles.length === 1 ? <CarrierTag carrier={row.carrier} /> : null}
                {profile.keywords.length ? (
                  <span className="ml-[1mm] font-condensed text-[0.85em] font-bold uppercase text-[#4a4a44]">
                    [<RuleTerms names={profile.keywords} />]
                  </span>
                ) : null}
              </span>
              {[
                profile.range,
                profile.attacks,
                profile.skill,
                profile.strength,
                profile.ap,
                profile.damage,
              ].map((value, index) => (
                <span
                  key={columns[index]}
                  className={`${index === 0 ? RANGE_COLUMN : STAT_COLUMN} text-center font-medium`}
                >
                  {value || "–"}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** "SUPERIOR" after a weapon only the squad's leader carries. */
export function CarrierTag({ carrier }: { carrier?: string }) {
  if (!carrier) return null;
  return (
    <span className="ml-[1.2mm] inline-block rounded-[0.6mm] border border-[var(--accent)] px-[0.8mm] align-[0.08em] font-condensed text-[0.72em] font-bold uppercase leading-[1.25] tracking-[0.04em] text-[var(--accent)]">
      {carrier}
    </span>
  );
}

/** "4×" in front of a weapon: how many models in the unit carry it. */
function Count({ value }: { value: number }) {
  return (
    <span className="mr-[1mm] inline-block min-w-[1.9em] font-condensed font-extrabold text-[var(--accent)]">
      {value}×
    </span>
  );
}

export function AbilityList({ abilities }: { abilities: Ability[] }) {
  return (
    <>
      {abilities.map((ability) => (
        <p key={ability.name} className="mt-[0.9mm] leading-snug">
          <b>{ability.name}:</b> <Rich html={ability.html} />
        </p>
      ))}
    </>
  );
}

export function AbilitiesBlock({ sheet }: { sheet: Datasheet }) {
  return (
    <div>
      <SectionBar title="Abilities" />
      <div className="px-[1.6mm] pb-[1mm]">
        {sheet.coreAbilities.length ? (
          <p className="mt-[0.9mm]">
            <b className="uppercase">Core:</b> <RuleTerms names={sheet.coreAbilities} />
          </p>
        ) : null}
        {sheet.factionAbilities.length ? (
          <p className="mt-[0.9mm]">
            <b className="uppercase">Faction:</b> <RuleTerms names={sheet.factionAbilities} />
          </p>
        ) : null}
        <AbilityList abilities={sheet.abilities} />
      </div>
      {sheet.wargearAbilities.length ? (
        <>
          <SectionBar title="Wargear abilities" />
          <div className="px-[1.6mm] pb-[1mm]">
            <AbilityList abilities={sheet.wargearAbilities} />
          </div>
        </>
      ) : null}
      {sheet.enhancement ? (
        <>
          <SectionBar title="Enhancement" />
          <div className="px-[1.6mm] pb-[1mm]">
            <AbilityList abilities={[sheet.enhancement]} />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CompositionBlock({ sheet }: { sheet: Datasheet }) {
  return (
    <div>
      <SectionBar title="Unit composition" />
      <div className="px-[1.6mm] pb-[1mm]">
        {sheet.models.map((model) => (
          <p key={model.name} className="mt-[0.7mm]">
            <span className="mr-[1mm] text-[0.75em]">■</span>
            {model.count} {model.name}
          </p>
        ))}
        <p className="mt-[0.9mm] font-semibold">
          {sheet.points} points{sheet.isWarlord ? " · Warlord" : ""}
        </p>
      </div>
    </div>
  );
}

export function Rich({ html }: { html: string }) {
  // Sanitized on the server: only b, br, p, ul, li and keyword spans survive.
  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized rules text.
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** "Canoness with Jump Pack" → ["Canoness", "with Jump Pack"], like the official title. */
export function splitName(name: string): [string, string | undefined] {
  const match = /^(.+?)\s+(with .+)$/i.exec(name);
  return match ? [match[1] ?? name, match[2]] : [name, undefined];
}
