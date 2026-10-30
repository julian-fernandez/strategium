import { type FactionBundle, ruleKey } from "../bundle";
import type { ArmyList } from "../list/types";
import { phaseIndex } from "../stratagems";
import type {
  Ability,
  Army,
  ArmyRules,
  AttachedGroup,
  BattleSize,
  CrossCheckIssue,
  Datasheet,
  DataVersions,
  ListFormat,
  Stratagem,
} from "../types";
import { comparable } from "../wahapedia";
import { findUnit, resolveDatasheet } from "./datasheet";

/** Battle sizes the app is built for. Anything else still loads, with a warning. */
const SUPPORTED_SIZES = [
  { name: "Incursion", points: 1000 },
  { name: "Strike Force", points: 2000 },
];

/** Builds an army from a parsed list and its faction's bundle. Runs in the browser. */
export function buildArmy(
  list: ArmyList,
  bundle: FactionBundle,
  versions: DataVersions,
  format?: ListFormat,
): Army {
  const warnings = [...list.warnings];
  if (!bundle.wahapediaFactionId) {
    warnings.push(`Wahapedia has no faction named "${list.faction}", so there are no stratagems.`);
  }

  const detachments = matchDetachments(bundle, list.detachmentText);
  if (detachments.unmatched) {
    warnings.push(
      `Couldn't match "${detachments.unmatched}" to a detachment; its stratagems are missing.`,
    );
  }

  // A datasheet taken again can cost more, depending on how many copies come before it.
  const copies = new Map<string, number>();
  const units = list.units.map((unit, index) => {
    const name = findUnit(bundle, unit.name)?.name ?? unit.name;
    const before = copies.get(name) ?? 0;
    copies.set(name, before + 1);
    const sheet = resolveDatasheet(bundle, unit, `u${index + 1}`, before);
    if (!sheet.warnings.length && !sheet.wahapediaId) {
      sheet.warnings.push(
        `Wahapedia has no datasheet named "${unit.name}", so it has no stratagems.`,
      );
    }
    return sheet;
  });
  for (const unit of units) for (const warning of unit.warnings) warnings.push(warning);
  // Lists carry the points their builder priced them at; a difference means either side is out of date.
  const listed = units.reduce((sum, unit) => sum + unit.listedPoints, 0);
  const priced = units.reduce((sum, unit) => sum + unit.points, 0);
  if (listed && listed !== priced) {
    warnings.push(
      `The list adds up to ${listed.toLocaleString("en")} pts; at the current points it's ${priced.toLocaleString("en")}.`,
    );
  }
  // Most names unknown: almost always an export in another language.
  const unknown = warnings.filter((w) => w.includes("has no unit named")).length;
  if (unknown >= 3 && unknown >= units.length / 2) {
    warnings.unshift(
      `${unknown} unit names aren't in BSData, which only has English names. ` +
        "If this list was exported in another language, export it in English.",
    );
  }
  if (bundle.faction === "Space Marines" && unknown) {
    warnings.push(
      "Chapter units (Guilliman, the Khans…) are in their chapter's data; name the chapter at the top of the list.",
    );
  }

  const usable = (unit: Datasheet) =>
    new Set(findUnit(bundle, unit.name)?.wahapedia?.stratagemIds ?? []);
  const usableByUnit = new Map(units.map((unit) => [unit.id, usable(unit)]));
  const stratagems = selectStratagems(bundle, detachments.matched, units, usableByUnit);

  const groups: AttachedGroup[] = [];
  for (const unit of units) {
    if (!unit.attachment) continue;
    let group = groups.find((g) => g.id === unit.attachment?.group);
    if (!group) {
      group = { id: unit.attachment.group, bodyguardId: "", characterIds: [], stratagemIds: [] };
      groups.push(group);
    }
    if (unit.attachment.role === "bodyguard") group.bodyguardId = unit.id;
    else group.characterIds.push(unit.id);
  }
  for (const group of groups) {
    const members = [group.bodyguardId, ...group.characterIds];
    group.stratagemIds = stratagems
      .filter((s) => members.some((id) => usableByUnit.get(id)?.has(s.id)))
      .map((s) => s.id);
    if (!group.bodyguardId) warnings.push(`Attached unit ${group.id} has no bodyguard unit.`);
  }

  return {
    note: list.note,
    faction: list.faction,
    detachments: detachments.matched.map((d) => d.name),
    disposition: list.disposition,
    battleSize: list.battleSize ? battleSize(list.battleSize, warnings) : undefined,
    format,
    units,
    groups,
    stratagems,
    armyRules: armyRules(bundle, detachments.matched, units),
    glossary: glossary(bundle, units),
    crossCheck: crossCheck(bundle, units),
    warnings,
    data: {
      ...versions,
      bsdataSha: bundle.sources.bsdataSha,
      wahapediaUpdate: bundle.sources.wahapediaUpdate,
    },
  };
}

/**
 * Core stratagems plus those of the army's detachments, kept only when a unit
 * in the army can use them, or when they target no unit at all (New Orders).
 */
function selectStratagems(
  bundle: FactionBundle,
  detachments: { id: string }[],
  units: Datasheet[],
  usableByUnit: Map<string, Set<string>>,
): Stratagem[] {
  const chosen = new Set(detachments.map((d) => d.id));
  const unitNames = new Set(units.map((unit) => unit.name));
  const selected: Stratagem[] = [];

  for (const stratagem of bundle.stratagems) {
    if (stratagem.detachment && !chosen.has(stratagem.detachmentId)) continue;
    const usableBy = [
      ...new Set(units.filter((u) => usableByUnit.get(u.id)?.has(stratagem.id)).map((u) => u.name)),
    ];
    if (usableBy.length === 0 && stratagem.targetsUnits) continue;
    selected.push({
      id: stratagem.id,
      name: stratagem.name,
      cp: stratagem.cp,
      type: stratagem.type,
      phase: stratagem.phase,
      turn: stratagem.turn,
      detachment: stratagem.detachment,
      html: stratagem.html,
      when: stratagem.when,
      usableBy,
      everyUnit: usableBy.length === unitNames.size,
    });
  }

  return selected.sort(
    (a, b) =>
      phaseIndex(a.phase) - phaseIndex(b.phase) ||
      Number(a.detachment === "") - Number(b.detachment === "") ||
      a.name.localeCompare(b.name),
  );
}

/** The army rule (faction rules most units share), the detachment rules and the enhancements taken. */
function armyRules(
  bundle: FactionBundle,
  detachments: { id: string; name: string }[],
  units: Datasheet[],
): ArmyRules {
  const counts = new Map<string, number>();
  for (const unit of units) {
    for (const rule of new Set(unit.factionAbilities))
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
  }
  const rules = [...counts]
    .filter(([, count]) => count >= units.length / 2)
    .map(([name]) => bundle.rules[ruleKey(name)])
    .filter((rule): rule is Ability => Boolean(rule));

  const chosen = detachments
    .map((d) => bundle.detachments.find((data) => data.id === d.id))
    .filter((d): d is FactionBundle["detachments"][number] => Boolean(d));

  const enhancements = units.flatMap((unit) => {
    if (!unit.enhancement) return [];
    const data = chosen
      .flatMap((d) => d.enhancements)
      .find((e) => comparable(e.name) === comparable(unit.enhancement?.name ?? ""));
    return [
      {
        name: unit.enhancement.name,
        cost: data?.cost ?? "",
        bearer: unit.name,
        html: unit.enhancement.html || data?.html || "",
      },
    ];
  });

  return {
    rules,
    detachments: chosen.map((d) => ({ name: d.name, rules: d.rules })),
    enhancements,
  };
}

/** The text of every rule the army's cards name, alphabetically. */
function glossary(bundle: FactionBundle, units: Datasheet[]): Ability[] {
  const found = new Map<string, Ability>();
  const add = (name: string) => {
    const key = ruleKey(name);
    const rule = bundle.rules[key];
    if (rule && !found.has(key)) found.set(key, rule);
  };
  for (const unit of units) {
    for (const name of [...unit.coreAbilities, ...unit.factionAbilities]) add(name);
    for (const row of [...unit.ranged, ...unit.melee]) {
      for (const profile of row.profiles) for (const keyword of profile.keywords) add(keyword);
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The compile-time cross-check, narrowed to the stat lines and weapons this army uses. */
function crossCheck(bundle: FactionBundle, units: Datasheet[]): CrossCheckIssue[] {
  const issues: CrossCheckIssue[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.name)) continue;
    seen.add(unit.name);
    const used = new Set([
      ...unit.stats.map((line) => line.name),
      ...[...unit.ranged, ...unit.melee].flatMap((row) => row.profiles.map((p) => p.name)),
    ]);
    for (const issue of findUnit(bundle, unit.name)?.crossCheck ?? []) {
      if ([...used].some((name) => issue.field.startsWith(`${name} `))) issues.push(issue);
    }
  }
  return issues;
}

function battleSize(size: { name: string; points: number }, warnings: string[]): BattleSize {
  const supported = SUPPORTED_SIZES.some((s) => s.points === size.points);
  if (!supported) {
    warnings.push(
      `${size.name} (${size.points} points) isn't a size the cards are tuned for (1,000 or 2,000).`,
    );
  }
  return { ...size, supported };
}

/**
 * Finds the detachments named in the header line. Names can contain "and", so
 * the faction's detachment names are matched longest first instead of splitting.
 */
export function matchDetachments(
  bundle: FactionBundle,
  text: string,
): { matched: { id: string; name: string }[]; unmatched?: string } {
  // Joiners vary ("A, B, and C", "A + B", line breaks), so punctuation counts as a space.
  const plain = (value: string) =>
    comparable(value)
      .replace(/[,+/;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  let rest = ` ${plain(text)} `;
  const matched: { id: string; name: string }[] = [];
  const byLength = [...bundle.detachments].sort((a, b) => b.name.length - a.name.length);
  for (const detachment of byLength) {
    const name = ` ${plain(detachment.name)} `;
    if (!rest.includes(name)) continue;
    matched.push({ id: detachment.id, name: detachment.name });
    rest = rest.replace(name, " ");
  }

  // "and" in every language the official app exports.
  const leftover = rest.replace(/(?:^|\s)(?:and|und|y|et|e|및|＆|&)(?=\s|$)/g, " ").trim();
  const lower = plain(text);
  return {
    matched: matched.sort((a, b) => lower.indexOf(plain(a.name)) - lower.indexOf(plain(b.name))),
    unmatched: leftover || undefined,
  };
}
