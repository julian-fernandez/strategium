/**
 * Read access to BSData's BattleScribe JSON: one faction catalogue, the
 * libraries it links, and the game system file with the core rules.
 */

export type BsCharacteristic = { name: string; $text?: string };

export type BsModifier = {
  field?: string;
  type?: string;
  value?: string | number;
  conditions?: unknown[];
  conditionGroups?: unknown[];
};

export type BsNode = {
  id?: string;
  name?: string;
  type?: string;
  hidden?: boolean;
  primary?: boolean;
  targetId?: string;
  typeName?: string;
  description?: string;
  importRootEntries?: boolean;
  characteristics?: BsCharacteristic[];
  modifiers?: BsModifier[];
  profiles?: BsNode[];
  rules?: BsNode[];
  infoLinks?: BsNode[];
  categoryLinks?: BsNode[];
  categoryEntries?: BsNode[];
  selectionEntries?: BsNode[];
  selectionEntryGroups?: BsNode[];
  entryLinks?: BsNode[];
  catalogueLinks?: BsNode[];
  sharedSelectionEntries?: BsNode[];
  sharedSelectionEntryGroups?: BsNode[];
  sharedProfiles?: BsNode[];
  sharedRules?: BsNode[];
};

export type CatalogueFile = { name: string; root: BsNode; isGameSystem: boolean };

type Indexed = { node: BsNode; file: CatalogueFile };

/** Groups that never hold a unit's own wargear, skipped while searching. */
const SKIPPED_GROUPS =
  /^(crusade|battle honours|battle scars|battle traits|weapon modifications|crusade relic)/i;

export class Catalogues {
  readonly files: CatalogueFile[];
  private readonly byId = new Map<string, Indexed>();
  private readonly hiddenCategories = new Set<string>();

  constructor(files: CatalogueFile[]) {
    this.files = files;
    for (const file of files) this.index(file.root, file);
    for (const file of files) {
      for (const category of file.root.categoryEntries ?? []) {
        if (category.hidden && category.id) this.hiddenCategories.add(category.id);
      }
    }
  }

  /** The faction catalogue: the first non-game-system file. */
  get faction(): CatalogueFile | undefined {
    return this.files.find((file) => !file.isGameSystem);
  }

  lookup(id: string | undefined): Indexed | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  /** Follows a link to its target, keeping the link's own modifiers. */
  resolve(node: BsNode): BsNode {
    if (!node.targetId) return node;
    const target = this.byId.get(node.targetId)?.node;
    if (!target) return node;
    return { ...target, modifiers: [...(node.modifiers ?? []), ...(target.modifiers ?? [])] };
  }

  /** Finds a unit by its exact name, then ignoring case. */
  findUnit(name: string): BsNode | undefined {
    const candidates = this.rootEntries();
    return (
      candidates.find((entry) => entry.name === name) ??
      candidates.find((entry) => sameName(entry.name, name))
    );
  }

  /** Every unit-like entry a list can contain, across the faction and its imported libraries. */
  rootEntries(): BsNode[] {
    const entries: BsNode[] = [];
    for (const file of this.files) {
      for (const link of file.root.entryLinks ?? []) {
        const entry = this.resolve(link);
        if (entry.type === "unit" || entry.type === "model") entries.push(entry);
      }
      for (const entry of file.root.sharedSelectionEntries ?? []) {
        if (entry.type === "unit" || entry.type === "model") entries.push(entry);
      }
    }
    return entries;
  }

  /** Child entries. Groups (and links to groups) are flattened into their entries. */
  children(node: BsNode): BsNode[] {
    const out: BsNode[] = [...(node.selectionEntries ?? [])];
    for (const link of node.entryLinks ?? []) {
      const target = this.resolve(link);
      if (link.type !== "selectionEntryGroup") out.push(target);
      else if (!SKIPPED_GROUPS.test(target.name ?? "")) out.push(...this.children(target));
    }
    for (const group of node.selectionEntryGroups ?? []) {
      if (!SKIPPED_GROUPS.test(group.name ?? "")) out.push(...this.children(group));
    }
    return out;
  }

  /** Breadth-first search below `root` for an entry with this name. */
  findEntry(root: BsNode, name: string, predicate?: (node: BsNode) => boolean): BsNode | undefined {
    const queue = this.children(root);
    const seen = new Set<BsNode>();
    while (queue.length) {
      const node = queue.shift();
      if (!node || seen.has(node)) continue;
      seen.add(node);
      if (sameName(node.name, name) && (!predicate || predicate(node))) return node;
      queue.push(...this.children(node));
    }
    return undefined;
  }

  /** Profiles on the node and the ones it links to. */
  profiles(node: BsNode): BsNode[] {
    const out = [...(node.profiles ?? [])];
    for (const link of node.infoLinks ?? []) {
      if (link.type !== "profile") continue;
      const target = this.byId.get(link.targetId ?? "")?.node;
      if (target) out.push({ ...target, name: applyNameModifiers(target.name, link.modifiers) });
    }
    return out;
  }

  /** Rules on the node and the ones it links to, marked core when they come from the game system. */
  rules(node: BsNode): { name: string; description: string; core: boolean }[] {
    const out: { name: string; description: string; core: boolean }[] = [];
    for (const rule of node.rules ?? []) {
      out.push({ name: rule.name ?? "", description: rule.description ?? "", core: false });
    }
    for (const link of node.infoLinks ?? []) {
      if (link.type !== "rule") continue;
      const target = this.byId.get(link.targetId ?? "");
      if (!target) continue;
      out.push({
        name: applyNameModifiers(target.node.name ?? link.name, link.modifiers) ?? "",
        description: target.node.description ?? "",
        core: target.file.isGameSystem,
      });
    }
    return out;
  }

  /** Visible category names, primary first. Hidden ones are BSData bookkeeping, not keywords. */
  categories(node: BsNode): string[] {
    const links = [...(node.categoryLinks ?? [])].sort(
      (a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)),
    );
    return links
      .filter((link) => !this.hiddenCategories.has(link.targetId ?? ""))
      .map((link) => link.name ?? this.byId.get(link.targetId ?? "")?.node.name ?? "")
      .filter(Boolean);
  }

  private index(node: unknown, file: CatalogueFile): void {
    if (Array.isArray(node)) {
      for (const child of node) this.index(child, file);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as BsNode;
    if (record.id && !this.byId.has(record.id) && !record.targetId) {
      this.byId.set(record.id, { node: record, file });
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") this.index(value, file);
    }
  }
}

/** Applies unconditional `name` modifiers, e.g. "Feel No Pain" + "5+". */
export function applyNameModifiers(
  name: string | undefined,
  modifiers: BsModifier[] | undefined,
): string | undefined {
  let result = name;
  for (const modifier of modifiers ?? []) {
    if (
      modifier.field !== "name" ||
      modifier.conditions?.length ||
      modifier.conditionGroups?.length
    ) {
      continue;
    }
    if (modifier.type === "append") result = `${result ?? ""} ${modifier.value}`;
    if (modifier.type === "set") result = String(modifier.value);
  }
  return result;
}

export function sameName(a: string | undefined, b: string | undefined): boolean {
  return normalizeName(a) === normalizeName(b);
}

export function normalizeName(name: string | undefined): string {
  return (name ?? "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}
