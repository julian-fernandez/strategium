import { type CoreRule, parseCoreRules } from "../shared/coreRules";
import { readCoreRulesPage, readMeta } from "./store";
import { onDataChanged } from "./updates";

let cache: { dir: string; rules: Promise<CoreRule[]> } | undefined;

onDataChanged(() => {
  cache = undefined;
});

/**
 * The core rules for the Wahapedia snapshot in use, parsed once per snapshot.
 * Empty when there's no data yet or the page can't be read: rules then just
 * don't link to the core rules.
 */
export async function loadCoreRules(): Promise<CoreRule[]> {
  const meta = await readMeta();
  const snapshot = meta.wahapedia;
  if (!snapshot) return [];
  if (cache?.dir !== snapshot.dir) {
    const rules = readCoreRulesPage(snapshot)
      .then(parseCoreRules)
      .catch((error) => {
        console.warn(`Core rules: ${error instanceof Error ? error.message : error}`);
        cache = undefined;
        return [];
      });
    cache = { dir: snapshot.dir, rules };
  }
  return cache.rules;
}
