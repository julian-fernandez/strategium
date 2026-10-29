import { parsePipeCsv } from "../shared/csv";
import type { WahapediaFile } from "../shared/wahapedia";

export { WAHAPEDIA_FILES, type WahapediaFile } from "../shared/wahapedia";

const BSDATA_REPO = "BSData/wh40k-11e";
const BSDATA_BRANCH = "main";
const WAHAPEDIA_BASE = "https://wahapedia.ru/wh40k11ed/";
const USER_AGENT = "army-cards (personal datasheet printer)";

async function get(url: string, accept?: string): Promise<Response> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (accept) headers.Accept = accept;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response;
}

export async function fetchBsdataHead(): Promise<{ sha: string; date: string }> {
  const response = await get(
    `https://api.github.com/repos/${BSDATA_REPO}/commits/${BSDATA_BRANCH}`,
    "application/vnd.github+json",
  );
  const body = (await response.json()) as { sha: string; commit: { committer: { date: string } } };
  return { sha: body.sha, date: body.commit.committer.date };
}

/** Catalogue names (file names without `.json`) at a BSData commit. */
export async function fetchBsdataCatalogueNames(sha: string): Promise<string[]> {
  const response = await get(
    `https://api.github.com/repos/${BSDATA_REPO}/git/trees/${sha}`,
    "application/vnd.github+json",
  );
  const body = (await response.json()) as { tree: { path: string; type: string }[] };
  return body.tree
    .filter((entry) => entry.type === "blob" && entry.path.endsWith(".json"))
    .map((entry) => entry.path.slice(0, -".json".length));
}

export async function fetchBsdataCatalogue(sha: string, name: string): Promise<string> {
  const path = encodeURIComponent(`${name}.json`);
  const response = await get(`https://raw.githubusercontent.com/${BSDATA_REPO}/${sha}/${path}`);
  return response.text();
}

export async function fetchWahapediaFile(file: WahapediaFile): Promise<string> {
  const response = await get(`${WAHAPEDIA_BASE}${file}.csv`);
  return response.text();
}

/** Wahapedia's own "last updated" stamp, e.g. `2026-10-28 23:48:19`. */
export async function fetchWahapediaLastUpdate(): Promise<string> {
  const rows = parsePipeCsv(await fetchWahapediaFile("Last_update"));
  const stamp = rows[0]?.last_update;
  if (!stamp) throw new Error("Wahapedia Last_update.csv had no last_update value");
  return stamp;
}

export async function fetchListhammerListText(listId: string): Promise<string> {
  const response = await get(
    `https://listhammer.info/api/listSummary?listId=${encodeURIComponent(listId)}`,
    "application/json",
  );
  const body = (await response.json()) as {
    result?: { event_players?: { listText?: string } };
  };
  const text = body.result?.event_players?.listText;
  if (!text) throw new Error(`Listhammer returned no list text for ${listId}`);
  return text;
}
