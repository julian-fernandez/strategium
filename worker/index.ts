/**
 * The hosted app on Cloudflare. The web app and its data are static files
 * (`pnpm build:site`); this Worker answers the API routes the app calls from
 * those files, with the same bodies the local server sends (server/app.ts).
 * Only Listhammer links are fetched live. Data changes when the site is
 * deployed again, so checking for updates just reports the deployed versions.
 */
import { LISTHAMMER_URL, listhammerText } from "../server/sources";
import { bundleFile, iconFile, SITE_FILES } from "../shared/site";

type Env = { ASSETS: { fetch(request: Request | string): Promise<Response> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const data = (file: string) => env.ASSETS.fetch(new URL(`/data/${file}`, url).toString());
    const faction = url.searchParams.get("faction") ?? "";

    switch (`${request.method} ${url.pathname}`) {
      case "GET /api/meta":
      case "POST /api/updates/check":
        return data(SITE_FILES.meta);
      case "GET /api/health":
        return data(SITE_FILES.health);
      case "GET /api/core-rules":
        return data(SITE_FILES.coreRules);
      case "GET /api/lan":
        // Phones open the hosted address itself; there's no local network to offer.
        return Response.json([]);
      case "GET /api/bundle": {
        const file = bundleFile(faction);
        const response = file ? await data(file) : undefined;
        return response?.ok
          ? response
          : Response.json({ error: `No data for the faction "${faction}".` }, { status: 500 });
      }
      case "GET /api/icon": {
        const file = iconFile(faction);
        const response = file ? await data(file) : undefined;
        return response?.ok ? response : Response.json({ svg: null });
      }
      case "POST /api/listhammer":
        return listhammer(request);
    }
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

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
