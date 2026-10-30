import { findFaction } from "./factions";

/**
 * Faction emblems, from the warhammer40kgroup/wh40k-icon set, pinned to one
 * commit. They're Games Workshop's designs, so the server fetches each into
 * the data cache when it's first needed rather than the repo carrying them.
 * A faction the set has nothing for keeps the app's own emblem.
 */
export const ICON_SOURCE =
  "https://raw.githubusercontent.com/warhammer40kgroup/wh40k-icon/0374c01aae5b426abc72c3c4096542805519c717/";

/** Each faction's emblem in the set, by the faction's name in `FACTIONS`. */
const ICONS: Record<string, string> = {
  "Adepta Sororitas": "src/svgs/sisters-of-battle.svg",
  "Adeptus Custodes": "src/svgs/adeptus-custodes.svg",
  "Adeptus Mechanicus": "src/svgs/adeptus-mechanicus.svg",
  "Astra Militarum": "src/svgs/astra-militarum.svg",
  "Imperial Agents": "src/svgs/inqusition-01.svg",
  "Space Marines": "src/svgs/adeptus-astartes.svg",
  "Blood Angels": "src/svgs/blood-angels.svg",
  "Dark Angels": "src/svgs/dark-angels.svg",
  "Imperial Fists": "src/svgs/imperial-fists.svg",
  "Iron Hands": "src/svgs/iron-hands.svg",
  "Raven Guard": "src/svgs/raven-guard.svg",
  Salamanders: "src/svgs/salamanders.svg",
  "Space Wolves": "src/svgs/space-wolfs.svg",
  Ultramarines: "src/svgs/ultramarines.svg",
  "White Scars": "src/svgs/white-scars.svg",
  "Chaos Space Marines": "src/svgs/chaos-star-01.svg",
  "Chaos Daemons": "src/svgs/chaos-star-01.svg",
  "Death Guard": "src/svgs/death-guard.svg",
  "Emperor's Children": "src/svgs/emperors-children.svg",
  "Thousand Sons": "src/svgs/thousand-sons.svg",
  "World Eaters": "src/svgs/world-eaters.svg",
  Necrons: "src/svgs/Xenos/Necrons/necrons.svg",
  "T'au Empire": "src/svgs/Xenos/TauEmpire/tau.svg",
};

/** Where a faction's emblem is in the set, for a faction as a list names it. */
export function factionIconPath(faction: string): string | undefined {
  const name = findFaction(faction)?.name;
  return name ? ICONS[name] : undefined;
}
