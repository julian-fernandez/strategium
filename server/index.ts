import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { buildArmy } from "../shared/army";
import { SERVER_PORT, UPDATE_INTERVAL_MS } from "../shared/config";
import { parseArmyList } from "../shared/list/parse";
import type { DataVersions } from "../shared/types";
import { loadCatalogues, loadWahapedia } from "./data";
import { fetchListhammerListText } from "./sources";
import { type Meta, readMeta } from "./store";
import { checkForUpdates } from "./updates";

const LISTHAMMER_URL = /listhammer\.info\/list\/([A-Za-z0-9]+)/;
const LIST_CACHE_MS = 10 * 60 * 1000;

const armyRequest = z.union([
  z.object({ text: z.string().min(1) }),
  z.object({ url: z.string().regex(LISTHAMMER_URL, "Not a Listhammer list URL") }),
]);

const listCache = new Map<string, { text: string; at: number }>();

const app = new Hono();

app.get("/api/meta", async (c) => c.json(versions(await readMeta())));

app.post("/api/updates/check", async (c) => c.json(versions(await checkForUpdates())));

app.post("/api/army", async (c) => {
  const parsed = armyRequest.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return c.json({ error: parsed.error.issues[0]?.message ?? "Bad request" }, 400);

  try {
    const text = "url" in parsed.data ? await listhammerText(parsed.data.url) : parsed.data.text;
    const list = parseArmyList(text);
    if (!list.faction)
      return c.json({ error: "Couldn't find the faction line in that list." }, 400);

    const [catalogues, wahapedia, meta] = await Promise.all([
      loadCatalogues(list.faction),
      loadWahapedia(),
      readMeta(),
    ]);
    return c.json({ army: buildArmy(list, catalogues, wahapedia, versions(meta)), text });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

/** Listhammer lists are refetched at most every 10 minutes, so edits there show up. */
async function listhammerText(url: string): Promise<string> {
  const id = LISTHAMMER_URL.exec(url)?.[1] ?? "";
  const cached = listCache.get(id);
  if (cached && Date.now() - cached.at < LIST_CACHE_MS) return cached.text;
  const text = await fetchListhammerListText(id);
  listCache.set(id, { text, at: Date.now() });
  return text;
}

function versions(meta: Meta): DataVersions {
  return {
    bsdataSha: meta.bsdata?.sha,
    bsdataDate: meta.bsdata?.date,
    wahapediaUpdate: meta.wahapedia?.lastUpdate,
    checkedAt: meta.checkedAt,
    changedAt: meta.changedAt,
    lastError: meta.lastError,
  };
}

serve({ fetch: app.fetch, port: SERVER_PORT }, ({ port }) => {
  console.log(`army-cards server on http://localhost:${port}`);
});

const runCheck = () =>
  checkForUpdates().then((meta) => {
    if (meta.lastError) console.warn(`Update check failed: ${meta.lastError}`);
  });
void runCheck();
setInterval(runCheck, UPDATE_INTERVAL_MS);
