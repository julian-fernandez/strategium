import {
  COMPILER_VERSION,
  type FactionBundle,
  type ItemData,
  ruleKey,
  type UnitData,
} from "./bundle";

/**
 * Audits everything compiled data can show: each unit's stat lines, weapons
 * and abilities, each stratagem, detachment rule, enhancement and rule text.
 * `pnpm data-check` runs it from the command line; the server runs it after
 * each data update, for the Data tab.
 *
 * Errors are things a card or screen would show wrong: empty text, markup
 * left in it, a weapon or stat line with a blank column, a stratagem the
 * phase filter can't place. Notes are worth knowing but not wrong: a keyword
 * with no rule text behind it, a unit with no background text.
 */
export type AuditSeverity = "error" | "note";

/** One kind of finding, and every place it was found. */
export type AuditFinding = { kind: string; severity: AuditSeverity; places: string[] };

export type DataHealth = {
  checkedAt: string;
  /** The data the audit read, so a newer sync or compiler knows it's out of date. */
  compilerVersion: number;
  bsdataSha?: string;
  wahapediaUpdate?: string;
  factions: number;
  units: number;
  stratagems: number;
  detachments: number;
  errors: number;
  /** Errors first, then the most common. */
  findings: AuditFinding[];
};

const PHASE = /command|movement|shooting|charge|fight|any/i;
const TURN = /your|opponent|either/i;

/** Takes one faction at a time, so a whole audit never holds every faction in memory. */
export class DataAudit {
  private readonly found = new Map<string, { severity: AuditSeverity; places: Set<string> }>();
  /** Library units (Imperial Agents, the Space Marine core) appear in many bundles; each is checked once. */
  private readonly seenUnits = new Set<string>();
  private counts = { factions: 0, units: 0, stratagems: 0, detachments: 0 };

  add(faction: string, bundle: FactionBundle): void {
    this.counts.factions++;
    for (const unit of Object.values(bundle.units)) {
      const id = `${unit.name}|${unit.keywords.join(",")}`;
      if (this.seenUnits.has(id)) continue;
      this.seenUnits.add(id);
      this.counts.units++;
      this.unit(bundle, unit, faction);
    }
    for (const stratagem of bundle.stratagems) {
      this.counts.stratagems++;
      const where = `${faction}: ${stratagem.name}`;
      if (!stratagem.html.trim()) this.note("error", "stratagem with no text", where);
      else this.text("stratagem", stratagem.html, where);
      if (!stratagem.when.trim())
        this.note(
          "error",
          "stratagem with no WHEN line (lists show nothing under its name)",
          where,
        );
      if (!/^\d+$/.test(stratagem.cp.trim()))
        this.note("error", "stratagem cost that isn't a number", `${where} (${stratagem.cp})`);
      if (!PHASE.test(stratagem.phase))
        this.note(
          "error",
          "stratagem phase the phase filter can't place",
          `${where} ("${stratagem.phase}")`,
        );
      if (stratagem.turn && !TURN.test(stratagem.turn))
        this.note(
          "error",
          "stratagem turn the turn filter can't place",
          `${where} ("${stratagem.turn}")`,
        );
    }
    for (const detachment of bundle.detachments) {
      this.counts.detachments++;
      const where = `${faction}: ${detachment.name}`;
      if (!detachment.rules.length) this.note("note", "detachment with no rule", where);
      for (const rule of detachment.rules) {
        if (!rule.html.trim())
          this.note("error", "detachment rule with no text", `${where} / ${rule.name}`);
        else this.text("detachment rule", rule.html, `${where} / ${rule.name}`);
      }
      for (const enhancement of detachment.enhancements) {
        const place = `${where} / ${enhancement.name}`;
        if (!enhancement.html.trim()) this.note("error", "enhancement with no text", place);
        else this.text("enhancement", enhancement.html, place);
        if (enhancement.cost && !/^\d+$/.test(enhancement.cost.trim()))
          this.note(
            "error",
            "enhancement cost that isn't a number",
            `${place} (${enhancement.cost})`,
          );
      }
    }
    for (const [key, rule] of Object.entries(bundle.rules)) {
      if (!rule.html.trim())
        this.note("error", "rule with no text", `${faction}: ${rule.name || key}`);
      else this.text("rule", rule.html, `${faction}: ${rule.name}`);
    }
  }

  /** A faction whose data didn't load or compile at all. */
  failed(faction: string, error: unknown): void {
    const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
    this.note("error", "faction that didn't compile", `${faction}: ${reason}`);
  }

  result(sources: { bsdataSha?: string; wahapediaUpdate?: string }): DataHealth {
    const findings = [...this.found]
      .map(([kind, { severity, places }]) => ({ kind, severity, places: [...places] }))
      .sort((a, b) =>
        a.severity === b.severity
          ? b.places.length - a.places.length
          : a.severity === "error"
            ? -1
            : 1,
      );
    return {
      checkedAt: new Date().toISOString(),
      compilerVersion: COMPILER_VERSION,
      ...sources,
      ...this.counts,
      errors: findings
        .filter((f) => f.severity === "error")
        .reduce((n, f) => n + f.places.length, 0),
      findings,
    };
  }

  private unit(bundle: FactionBundle, unit: UnitData, faction: string): void {
    const where = `${faction}: ${unit.name}`;
    const models = Object.values(unit.models);
    const lines = [...unit.stats, ...models.flatMap((model) => model.stats)];
    // BSData keeps some model types and wargear at the top level ("Loota", "Searchlight"); a list
    // never names them as units. Wahapedia knowing it as a datasheet says it's a real one.
    if (!unit.wahapedia && (!models.length || !lines.length || !unit.keywords.length)) {
      this.note(
        "note",
        "BSData entry that isn't a datasheet (a model or wargear kept at the top)",
        where,
      );
      return;
    }
    if (!models.length) this.note("error", "unit with no models", where);
    if (!lines.length) this.note("error", "unit with no stat line", where);
    for (const line of lines) {
      const blank = (["m", "t", "sv", "w", "ld", "oc"] as const).filter(
        (field) => !line[field].trim(),
      );
      if (blank.length)
        this.note(
          "error",
          "stat line with a blank characteristic",
          `${where} / ${line.name} (${blank.join(", ")})`,
        );
    }
    if (!unit.keywords.length) this.note("error", "unit with no keywords", where);
    if (!unit.factionKeywords.length) this.note("note", "unit with no faction keyword", where);
    if (!unit.wahapedia?.legend) this.note("note", "unit with no background text", where);
    const priced = unit.points.base > 0 || models.some((model) => model.cost > 0);
    if (!priced) this.note("note", "unit with no points", where);

    const abilities = new Set(unit.abilities.map((a) => ruleKey(a.name)));
    for (const ability of unit.abilities) this.ability(ability, where);
    if (unit.attachTo && !unit.attachTo.html.trim())
      this.note("error", `empty ${unit.attachTo.title} box`, where);
    const items = new Map<string, ItemData>();
    for (const [key, item] of Object.entries(unit.items)) items.set(key, item);
    for (const model of models)
      for (const [key, item] of Object.entries(model.items)) items.set(key, item);
    for (const item of items.values()) {
      for (const ability of item.abilities) {
        this.ability(ability, `${where} / ${item.name}`);
        abilities.add(ruleKey(ability.name));
      }
    }
    for (const item of items.values()) {
      for (const weapon of [...item.ranged, ...item.melee]) {
        const blank = (["range", "attacks", "skill", "strength", "ap", "damage"] as const).filter(
          (field) => !weapon[field].trim(),
        );
        if (blank.length)
          this.note(
            "error",
            "weapon with a blank column",
            `${where} / ${weapon.name} (${blank.join(", ")})`,
          );
        for (const keyword of weapon.keywords) {
          // A keyword only this unit has ("Hooked") is explained by the unit's own ability.
          const key = ruleKey(keyword);
          if (!bundle.rules[key] && !abilities.has(key))
            this.note(
              "note",
              "weapon keyword with no rule text (tapping it does nothing)",
              `${faction}: ${keyword}`,
            );
        }
      }
    }
    for (const name of [...unit.coreRules, ...unit.factionRules]) {
      if (!bundle.rules[ruleKey(name)])
        this.note(
          "note",
          "ability named on a card with no rule text (tapping it does nothing)",
          `${faction}: ${name}`,
        );
    }
  }

  private ability(ability: { name: string; html: string }, where: string): void {
    const place = `${where} / ${ability.name}`;
    if (!ability.html.trim()) this.note("error", "ability with no text", place);
    else this.text("ability", ability.html, place);
    const [, type, name] = ability.name.match(/^(.+?): (.+)$/) ?? [];
    if (type && type === name) this.note("error", "ability label that repeats itself", place);
  }

  /** Markup that should have become formatting, or tags that shouldn't be there at all. */
  private text(kind: string, html: string, where: string): void {
    if (/\*\*|\^\^/.test(html))
      this.note("error", `${kind} with BSData markup left in it (** or ^^)`, where);
    if (/&lt;\/?(?:b|i|br|p|ins|span|ul|li)\b/i.test(html))
      this.note("error", `${kind} with an escaped HTML tag showing`, where);
    if (/<(?!\/?(?:b|strong|i|em|u|br|p|ul|li|span)\b)[a-z]/i.test(html))
      this.note("error", `${kind} with an unexpected HTML tag`, where);
    if (/(<br>\s*){3,}/.test(html)) this.note("note", `${kind} with a run of blank lines`, where);
  }

  private note(severity: AuditSeverity, kind: string, place: string): void {
    const entry = this.found.get(kind) ?? { severity, places: new Set<string>() };
    entry.places.add(place);
    this.found.set(kind, entry);
  }
}
