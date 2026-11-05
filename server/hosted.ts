/**
 * The hosted site's API. The web app and its data are static files
 * (`pnpm build:site`); this answers the API routes the app calls from those
 * files, with the same bodies the local server sends (server/app.ts). Only
 * Listhammer links are fetched live. Data changes when the site is deployed
 * again, so checking for updates just reports the deployed versions.
 *
 * Nothing here needs Node: it runs as a Vercel edge function (vercel/api.ts).
 */
import { bundleFile, iconFile, SITE_FILES } from "../shared/site";
import { LISTHAMMER_URL, listhammerText } from "./sources";

/** Reads one of the built data files (a path under `data/`), as a response to send on. */
export type ReadData = (file: string) => Promise<Response>;

export async function hostedApi(request: Request, readData: ReadData): Promise<Response> {
  const url = new URL(request.url);
  const faction = url.searchParams.get("faction") ?? "";

  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/meta":
    case "POST /api/updates/check":
      return readData(SITE_FILES.meta);
    case "GET /api/health":
      return readData(SITE_FILES.health);
    case "GET /api/core-rules":
      return readData(SITE_FILES.coreRules);
    case "GET /api/lan":
      // Phones open the hosted address itself; there's no local network to offer.
      return Response.json([]);
    case "GET /api/bundle": {
      const file = bundleFile(faction);
      const response = file ? await readData(file) : undefined;
      return response?.ok
        ? response
        : Response.json({ error: `No data for the faction "${faction}".` }, { status: 500 });
    }
    case "GET /api/icon": {
      const file = iconFile(faction);
      const response = file ? await readData(file) : undefined;
      return response?.ok ? response : Response.json({ svg: null });
    }
    case "POST /api/listhammer":
      return listhammer(request);
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

/** Every route the app calls, so each can be its own function on the host. */
export const HOSTED_ROUTES = [
  "meta",
  "updates/check",
  "health",
  "core-rules",
  "lan",
  "bundle",
  "icon",
  "listhammer",
];

async function listhammer(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url : "";
  if (!LISTHAMMER_URL.test(url)) {
    return Response.json({ error: "Not a Listhammer list URL" }, { status: 400 });
  }
  try {
    return Response.json({ text: await listhammerText(url) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
