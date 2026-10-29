/**
 * Every faction a list can name, and what each source calls it. Lists name
 * factions in many ways ("T’au Empire", "Xenos - Tyranids", "Imperial
 * Agents", "Caballeros Grises"); BSData and Wahapedia each have their own
 * names too. Wahapedia files every Space Marine chapter under Space Marines.
 */
export type Faction = {
  /** As the official app writes it. */
  name: string;
  /** The BSData catalogue file. */
  catalogue: string;
  /** Wahapedia's faction name; empty when Wahapedia has none. */
  wahapedia: string;
  /** Other names lists use: other builders' labels, other languages. */
  aliases?: string[];
  /** A Space Marine chapter: chosen over plain "Space Marines" when a list names both. */
  chapter?: boolean;
};

const MARINES = "Space Marines";

export const FACTIONS: Faction[] = [
  {
    name: "Adepta Sororitas",
    catalogue: "Imperium - Adepta Sororitas",
    wahapedia: "Adepta Sororitas",
    aliases: ["Sisters of Battle"],
  },
  {
    name: "Adeptus Custodes",
    catalogue: "Imperium - Adeptus Custodes",
    wahapedia: "Adeptus Custodes",
  },
  {
    name: "Adeptus Mechanicus",
    catalogue: "Imperium - Adeptus Mechanicus",
    wahapedia: "Adeptus Mechanicus",
  },
  {
    name: "Adeptus Titanicus",
    catalogue: "Imperium - Adeptus Titanicus",
    wahapedia: "Adeptus Titanicus",
    aliases: ["Titan Legions"],
  },
  {
    name: "Astra Militarum",
    catalogue: "Imperium - Astra Militarum",
    wahapedia: "Astra Militarum",
    aliases: ["Imperial Guard"],
  },
  {
    name: "Grey Knights",
    catalogue: "Imperium - Grey Knights",
    wahapedia: "Grey Knights",
    aliases: ["Caballeros Grises", "Chevaliers Gris", "Cavalieri Grigi"],
  },
  {
    name: "Imperial Agents",
    catalogue: "Imperium - Agents of the Imperium",
    wahapedia: "Imperial Agents",
    aliases: ["Agents of the Imperium"],
  },
  {
    name: "Imperial Knights",
    catalogue: "Imperium - Imperial Knights",
    wahapedia: "Imperial Knights",
    aliases: [
      "Imperiale Ritter",
      "Caballeros Imperiales",
      "Chevaliers Impériaux",
      "Cavalieri Imperiali",
    ],
  },
  {
    name: MARINES,
    catalogue: "Imperium - Space Marines",
    wahapedia: MARINES,
    aliases: [
      "Adeptus Astartes",
      "Marines Espaciales",
      "アデプトゥス・アスタルテス",
      "아뎁투스 아스타르테스",
    ],
  },
  {
    name: "Black Templars",
    catalogue: "Imperium - Black Templars",
    wahapedia: MARINES,
    chapter: true,
    aliases: ["Templarios Negros", "Templiers Noirs", "Templari Neri"],
  },
  {
    name: "Blood Angels",
    catalogue: "Imperium - Blood Angels",
    wahapedia: MARINES,
    chapter: true,
    aliases: [
      "Ángeles Sangrientos",
      "Anges de Sang",
      "Angeli Sanguinari",
      "ブラッドエンジェル",
      "블러드 엔젤",
    ],
  },
  {
    name: "Dark Angels",
    catalogue: "Imperium - Dark Angels",
    wahapedia: MARINES,
    chapter: true,
    aliases: ["Ángeles Oscuros", "Anges Noirs", "Angeli Oscuri", "ダークエンジェル", "다크 엔젤"],
  },
  { name: "Deathwatch", catalogue: "Imperium - Deathwatch", wahapedia: MARINES, chapter: true },
  {
    name: "Imperial Fists",
    catalogue: "Imperium - Imperial Fists",
    wahapedia: MARINES,
    chapter: true,
  },
  { name: "Iron Hands", catalogue: "Imperium - Iron Hands", wahapedia: MARINES, chapter: true },
  { name: "Raven Guard", catalogue: "Imperium - Raven Guard", wahapedia: MARINES, chapter: true },
  {
    name: "Salamanders",
    catalogue: "Imperium - Salamanders",
    wahapedia: MARINES,
    chapter: true,
    aliases: ["サラマンダー", "샐러맨더"],
  },
  {
    name: "Space Wolves",
    catalogue: "Imperium - Space Wolves",
    wahapedia: MARINES,
    chapter: true,
    aliases: [
      "Lobos Espaciales",
      "Loups Spatiaux",
      "Lupi Siderali",
      "スペースウルフ",
      "스페이스 울프",
    ],
  },
  {
    name: "Ultramarines",
    catalogue: "Imperium - Ultramarines",
    wahapedia: MARINES,
    chapter: true,
    aliases: ["Ultramarinos", "ウルトラマリーン", "울트라마린"],
  },
  { name: "White Scars", catalogue: "Imperium - White Scars", wahapedia: MARINES, chapter: true },
  {
    name: "Chaos Space Marines",
    catalogue: "Chaos - Chaos Space Marines",
    wahapedia: "Chaos Space Marines",
    aliases: ["Heretic Astartes", "Marines Espaciales del Caos", "Space Marines du Chaos"],
  },
  {
    name: "Chaos Daemons",
    catalogue: "Chaos - Chaos Daemons",
    wahapedia: "Chaos Daemons",
    aliases: ["Legiones Daemonica", "Demonios del Caos", "Démons du Chaos"],
  },
  {
    name: "Chaos Knights",
    catalogue: "Chaos - Chaos Knights",
    wahapedia: "Chaos Knights",
    aliases: ["Caballeros del Caos", "Chevaliers du Chaos"],
  },
  {
    name: "Death Guard",
    catalogue: "Chaos - Death Guard",
    wahapedia: "Death Guard",
    aliases: ["Guardia de la Muerte", "Garde de la Mort"],
  },
  {
    name: "Emperor's Children",
    catalogue: "Chaos - Emperor's Children",
    wahapedia: "Emperor’s Children",
    aliases: ["Hijos del Emperador", "Enfants de l'Empereur"],
  },
  {
    name: "Thousand Sons",
    catalogue: "Chaos - Thousand Sons",
    wahapedia: "Thousand Sons",
    aliases: ["Mil Hijos", "Mille Fils"],
  },
  {
    name: "World Eaters",
    catalogue: "Chaos - World Eaters",
    wahapedia: "World Eaters",
    aliases: ["Devoradores de Mundos", "Mangeurs de Mondes"],
  },
  { name: "Titanicus Traitoris", catalogue: "Chaos - Titanicus Traitoris", wahapedia: "" },
  {
    name: "Aeldari",
    catalogue: "Aeldari - Craftworlds",
    wahapedia: "Aeldari",
    aliases: ["Craftworlds", "Asuryani", "Eldar"],
  },
  {
    name: "Drukhari",
    catalogue: "Aeldari - Drukhari",
    wahapedia: "Drukhari",
    aliases: ["Dark Eldar"],
  },
  {
    name: "Genestealer Cults",
    catalogue: "Genestealer Cults",
    wahapedia: "Genestealer Cults",
    aliases: ["Genestealer Cult", "Cultos Genestealer"],
  },
  {
    name: "Leagues of Votann",
    catalogue: "Leagues of Votann",
    wahapedia: "Leagues of Votann",
    aliases: ["Ligas de Votann", "Ligues de Votann"],
  },
  { name: "Necrons", catalogue: "Necrons", wahapedia: "Necrons", aliases: ["Necrones"] },
  { name: "Orks", catalogue: "Orks", wahapedia: "Orks", aliases: ["Orkos"] },
  {
    name: "T'au Empire",
    catalogue: "T'au Empire",
    wahapedia: "T’au Empire",
    aliases: ["Tau Empire", "T'au", "Imperio T'au", "Empire T'au"],
  },
  {
    name: "Tyranids",
    catalogue: "Tyranids",
    wahapedia: "Tyranids",
    aliases: ["Tiránidos", "Tyranides", "Tiranidi"],
  },
];

/** Names compared loosely: case, curly apostrophes and a "Xenos - " style prefix don't matter. */
export function factionKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/^(?:imperium|chaos|xenos|aeldari)\s*-\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, Faction>();
for (const faction of FACTIONS) {
  for (const name of [faction.name, faction.catalogue, ...(faction.aliases ?? [])]) {
    BY_KEY.set(factionKey(name), faction);
  }
}

/** The faction a name refers to, by any of its names. */
export function findFaction(name: string): Faction | undefined {
  return BY_KEY.get(factionKey(name));
}

/**
 * The faction a block of text is for: the first faction name in it, except
 * that a Space Marine chapter wins over plain Space Marines ("Space Marines"
 * then "Ultramarines" is an Ultramarines list). Pass the list's header
 * lines first; names deep in a list (allies) are less reliable.
 */
export function detectFaction(text: string): Faction | undefined {
  const lower = text.toLowerCase().replace(/[’‘`]/g, "'");
  let first: { faction: Faction; at: number } | undefined;
  let chapter: { faction: Faction; at: number } | undefined;
  for (const [key, faction] of BY_KEY) {
    const at = indexOfWord(lower, key);
    if (at === -1) continue;
    if (
      !first ||
      at < first.at ||
      (at === first.at && key.length > factionKey(first.faction.name).length)
    ) {
      first = { faction, at };
    }
    // A chapter counts only as a field of its own, not inside a detachment's name ("Deathwatch Support").
    if (faction.chapter && standsAlone(lower, at, key.length) && (!chapter || at < chapter.at)) {
      chapter = { faction, at };
    }
  }
  if (chapter && first?.faction.name === MARINES) return chapter.faction;
  return first?.faction;
}

/** Where `word` first appears in `text` as a whole word (or phrase), or -1. */
function indexOfWord(text: string, word: string): number {
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(word, from);
    if (at === -1) return -1;
    const before = text[at - 1];
    const after = text[at + word.length];
    if (!isWordChar(before) && !isWordChar(after)) return at;
    from = at + 1;
  }
  return -1;
}

/** No other words run into it on either side: a line, or a " - " or "·" separated field. */
function standsAlone(text: string, at: number, length: number): boolean {
  const after = text.slice(at + length).match(/^[ \t]*(\S)?/)?.[1];
  const before = text.slice(0, at).match(/(\S)?[ \t]*$/)?.[1];
  return !isWordChar(after) && !isWordChar(before);
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}
