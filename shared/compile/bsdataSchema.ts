import { z } from "zod";
import type { BsNode } from "../bsdata/catalogues";
import { UpstreamFormatError } from "../wahapedia";

/**
 * The parts of BSData's BattleScribe JSON the compiler reads. Anything else
 * passes through untouched, so new upstream fields don't break the sync, but
 * a renamed or retyped one does, loudly.
 */
const characteristic = z.looseObject({
  name: z.string(),
  typeId: z.string().optional(),
  $text: z.string().optional(),
});

const condition = z.looseObject({
  type: z.string().optional(),
  field: z.string().optional(),
  scope: z.string().optional(),
  childId: z.string().optional(),
  value: z.union([z.number(), z.string()]).optional(),
});

const modifier = z.looseObject({
  field: z.string().optional(),
  type: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  conditions: z.array(condition).optional(),
  conditionGroups: z.array(z.unknown()).optional(),
});

const profileType = z.looseObject({
  id: z.string(),
  name: z.string(),
  characteristicTypes: z.array(z.looseObject({ id: z.string(), name: z.string() })).optional(),
});

const node: z.ZodType<BsNode> = z.lazy(() =>
  z.looseObject({
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    hidden: z.boolean().optional(),
    primary: z.boolean().optional(),
    targetId: z.string().optional(),
    typeName: z.string().optional(),
    description: z.string().optional(),
    importRootEntries: z.boolean().optional(),
    characteristics: z.array(characteristic).optional(),
    costs: z
      .array(
        z.looseObject({
          name: z.string().optional(),
          typeId: z.string().optional(),
          value: z.number().optional(),
        }),
      )
      .optional(),
    costTypes: z.array(z.looseObject({ id: z.string(), name: z.string() })).optional(),
    modifiers: z.array(modifier).optional(),
    profiles: z.array(node).optional(),
    rules: z.array(node).optional(),
    infoLinks: z.array(node).optional(),
    categoryLinks: z.array(node).optional(),
    categoryEntries: z.array(node).optional(),
    selectionEntries: z.array(node).optional(),
    selectionEntryGroups: z.array(node).optional(),
    entryLinks: z.array(node).optional(),
    catalogueLinks: z.array(node).optional(),
    sharedSelectionEntries: z.array(node).optional(),
    sharedSelectionEntryGroups: z.array(node).optional(),
    sharedProfiles: z.array(node).optional(),
    sharedRules: z.array(node).optional(),
    profileTypes: z.array(profileType).optional(),
  }),
);

/** A BSData file is `{ "catalogue": {...} }` or `{ "gameSystem": {...} }`. */
export function parseBsdataFile(name: string, json: unknown): BsNode {
  if (!json || typeof json !== "object") {
    throw new UpstreamFormatError(`BSData file "${name}" is not a JSON object.`);
  }
  const root =
    (json as Record<string, unknown>).catalogue ?? (json as Record<string, unknown>).gameSystem;
  if (!root) {
    throw new UpstreamFormatError(`BSData file "${name}" has no "catalogue" or "gameSystem" root.`);
  }
  const result = node.safeParse(root);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new UpstreamFormatError(
      `BSData file "${name}" changed shape at ${issue?.path.join(".") ?? "?"}: ${issue?.message ?? "invalid"}.`,
    );
  }
  return result.data;
}
