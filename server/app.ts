import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { compress } from "hono/compress";
import { etag } from "hono/etag";
import { z } from "zod";
import type { DataVersions } from "../shared/types";
import { loadBundle } from "./data";
import { factionIcon } from "./icons";
import { lanAddresses } from "./lan";
import { fetchListhammerListText } from "./sources";
import { type Meta, readMeta } from "./store";
import { checkForUpdates } from "./updates";

const LISTHAMMER_URL = /listhammer\.info\/list\/([A-Za-z0-9]+)/;
const LIST_CACHE_MS = 10 * 60 * 1000;
const listCache = new Map<string, { text: string; at: number }>();

/**
 * The API. Its type is exported, so the web app's client (hono/client) knows
 * every route, parameter and response without generated code.
 */
export const app = new Hono()
  .use("/api/bundle", compress(), etag())
  .get("/api/meta", async (c) => c.json(versions(await readMeta())))
  .post("/api/updates/check", async (c) => c.json(versions(await checkForUpdates())))
  .get("/api/lan", async (c) => c.json(await lanAddresses()))
  .get(
    "/api/bundle",
    zValidator("query", z.object({ faction: z.string().min(1) }), rejectInvalid),
    async (c) => {
      const { faction } = c.req.valid("query");
      try {
        // Revalidate on every load; the ETag makes an unchanged bundle a 304.
        c.header("Cache-Control", "no-cache");
        return c.json({ bundle: await loadBundle(faction) }, 200);
      } catch (error) {
        return c.json({ error: message(error) }, 500);
      }
    },
  )
  .get(
    "/api/icon",
    zValidator("query", z.object({ faction: z.string().min(1) }), rejectInvalid),
    async (c) => {
      // As text inside JSON, never served as an SVG document of its own. A faction
      // without one isn't an error: the app keeps its own emblem.
      const svg = (await factionIcon(c.req.valid("query").faction)) ?? null;
      c.header("Cache-Control", "max-age=86400");
      return c.json({ svg }, 200);
    },
  )
  .post(
    "/api/listhammer",
    zValidator(
      "json",
      z.object({ url: z.string().regex(LISTHAMMER_URL, "Not a Listhammer list URL") }),
      rejectInvalid,
    ),
    async (c) => {
      try {
        return c.json({ text: await listhammerText(c.req.valid("json").url) }, 200);
      } catch (error) {
        return c.json({ error: message(error) }, 502);
      }
    },
  );

export type AppType = typeof app;

/** Listhammer lists are refetched at most every 10 minutes, so edits there show up. */
async function listhammerText(url: string): Promise<string> {
  const id = LISTHAMMER_URL.exec(url)?.[1] ?? "";
  const cached = listCache.get(id);
  if (cached && Date.now() - cached.at < LIST_CACHE_MS) return cached.text;
  const text = await fetchListhammerListText(id);
  listCache.set(id, { text, at: Date.now() });
  return text;
}

/** Invalid input answers like every other failure: `{ error }`, here with a 400. */
function rejectInvalid(
  result: { success: true } | { success: false; error: z.core.$ZodError },
  c: Context,
) {
  if (!result.success) return c.json({ error: z.prettifyError(result.error) }, 400);
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

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
