import type { CrossCheckIssue, Datasheet } from "./types";
import { comparable, type Wahapedia } from "./wahapedia";

/**
 * Compares each card's BSData numbers against Wahapedia's. BSData's conditional
 * modifiers aren't applied, so a difference here is worth a look before printing.
 */
export function crossCheck(data: Wahapedia, units: Datasheet[]): CrossCheckIssue[] {
  const issues: CrossCheckIssue[] = [];
  const seen = new Set<string>();

  for (const unit of units) {
    if (!unit.wahapediaId || seen.has(unit.name)) continue;
    seen.add(unit.name);

    const models = data.models.get(unit.wahapediaId) ?? [];
    for (const line of unit.stats) {
      const model =
        models.find((m) => comparable(m.name) === comparable(line.name)) ??
        (models.length === 1 || unit.stats.length === 1 ? models[0] : undefined);
      if (!model) continue;
      const pairs: [string, string | undefined, string][] = [
        ["M", line.m, model.m],
        ["T", line.t, model.t],
        ["Sv", line.sv, model.sv],
        ["W", line.w, model.w],
        ["Ld", line.ld, model.ld],
        ["OC", line.oc, model.oc],
        ["InSv", line.invSv, model.invSv],
      ];
      for (const [field, ours, theirs] of pairs) {
        if (!same(ours, theirs)) {
          issues.push({
            unit: unit.name,
            field: `${line.name} ${field}`,
            bsdata: ours ?? "",
            wahapedia: theirs,
          });
        }
      }
    }

    const weapons = data.wargear.get(unit.wahapediaId) ?? [];
    const rows = [
      ...unit.ranged.map((row) => ({ row, type: "ranged" })),
      ...unit.melee.map((row) => ({ row, type: "melee" })),
    ];
    for (const { row, type } of rows) {
      for (const profile of row.profiles) {
        // A weapon can have a ranged and a melee profile under the same name.
        const theirs = weapons.find(
          (w) =>
            w.type.toLowerCase() === type &&
            comparable(stripArrow(w.name)) === comparable(stripArrow(profile.name)),
        );
        if (!theirs) continue;
        const pairs: [string, string, string][] = [
          ["Range", profile.range, theirs.range],
          ["A", profile.attacks, theirs.attacks],
          ["BS/WS", profile.skill, theirs.skill],
          ["S", profile.strength, theirs.strength],
          ["AP", profile.ap, theirs.ap],
          ["D", profile.damage, theirs.damage],
        ];
        for (const [field, ours, value] of pairs) {
          if (!same(ours, value)) {
            issues.push({
              unit: unit.name,
              field: `${profile.name} ${field}`,
              bsdata: ours,
              wahapedia: value,
            });
          }
        }
      }
    }
  }

  return issues;
}

/** `5+` and `5`, `6"` and `6`, `N/A` and an empty cell all mean the same thing. */
function same(a: string | undefined, b: string | undefined): boolean {
  const clean = (value: string | undefined) => {
    const v = (value ?? "")
      .toLowerCase()
      .replace(/[+"\s]/g, "")
      .replace(/[–−]/g, "-");
    return v === "n/a" || v === "-" ? "" : v;
  };
  return clean(a) === clean(b);
}

function stripArrow(name: string): string {
  return name.replace(/^➤\s*/, "");
}
