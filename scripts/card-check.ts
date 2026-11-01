/**
 * Loads lists in the running app and checks that no text is cut short: no
 * card's text spilling past its box at its smallest size, nothing on screen
 * ending in an ellipsis or a line clamp, and on a phone nothing wider than the
 * screen. Console errors count too. Needs `pnpm dev` running.
 *
 *   pnpm card-check                    every list in fixtures/lists, every tab
 *   pnpm card-check orks.txt tau.txt   just these
 *   pnpm card-check --all              everything the data can show (see below)
 *   pnpm card-check --all Orks         … for these factions
 *
 * --all builds made-up lists (scripts/synthetic-lists.ts) naming every
 * datasheet, every detachment and every enhancement, and checks the deck, the
 * stratagems and the rules they make. It runs twice: units as they come
 * (failures), then each carrying every weapon it could take at once, which
 * no real list does (warnings: a card that can't fit an impossible loadout).
 */
import { type Browser, chromium } from "playwright";
import { fixtureFiles, LISTS_DIR } from "../fixtures";
import { loadFactionBundle } from "../server/data";
import type { UnitData } from "../shared/bundle";
import { FACTIONS } from "../shared/factions";
import { readList } from "../shared/list/formats";
import { buildArmy } from "../shared/resolve/army";
import { type Loadout, syntheticLists } from "./synthetic-lists";

const APP = "http://localhost:5173/";
const PARALLEL = 4;
/** The first load of a faction compiles its bundle, which can take a while. */
const LOAD_TIMEOUT = 120_000;
const PHONE = { name: "phone", width: 390, height: 844, mobile: true };
const DESKTOP = { name: "desktop", width: 1440, height: 900, mobile: false };
/** Cards comes right after Army: on a phone it's a button on the Army tab, not in the tab bar. */
const EVERY_TAB = ["Army", "Cards", "Play", "Stratagems", "Rules"];
/**
 * Warnings a made-up list is expected to raise: its made-up prices, and units
 * Wahapedia doesn't have (Legends, Crucible), which only lose their stratagems.
 */
const EXPECTED_WARNING = /^The list adds up to |^Wahapedia has no datasheet named /;

type Size = typeof PHONE;
type Finding = { where: string; what: string };
type Job = {
  label: string;
  text: string;
  /** Tabs to check at each size. */
  sizes: [Size, string[]][];
  /** Units the list names, to check they all resolve; unset for real lists. */
  units?: number;
  /** For impossible loadouts: report, but don't fail. */
  warnOnly?: boolean;
  /** Stored settings for the page: the deck options and the phase filter. */
  storage?: Record<string, unknown>;
};

const args = process.argv.slice(2);
const all = args.includes("--all");
const wanted = args.filter((arg) => !arg.startsWith("--"));

try {
  await fetch(APP);
} catch {
  console.error(`Nothing is running at ${APP}. Start \`pnpm dev\` first.`);
  process.exit(1);
}

const jobs = all ? await everythingJobs() : fixtureJobs();
const started = Date.now();
const browser = await chromium.launch();
const results = new Map<string, { findings: Finding[]; warnOnly: boolean }>();
const queue = [...jobs];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const findings = await resolveCheck(job);
      for (const [size, tabs] of job.sizes) {
        findings.push(...(await checkList(browser, job, size, tabs)));
      }
      results.set(job.label, { findings, warnOnly: Boolean(job.warnOnly) });
      const mark = findings.length ? (job.warnOnly ? "!" : "✗") : "✓";
      console.log(`${mark} ${job.label}`);
      for (const finding of findings) console.log(`    ${finding.where}: ${finding.what}`);
    }
  }),
);
await browser.close();

const failed = [...results.values()].filter((r) => r.findings.length && !r.warnOnly).length;
const warned = [...results.values()].filter((r) => r.findings.length && r.warnOnly).length;
const minutes = ((Date.now() - started) / 60_000).toFixed(1);
console.log(
  `\n${results.size} lists in ${minutes} min: ` +
    (failed ? `${failed} with text cut short or errors` : "no text cut short, no errors") +
    (warned ? `; ${warned} warned (impossible loadouts that don't fit).` : "."),
);
if (failed) process.exitCode = 1;

function fixtureJobs(): Job[] {
  return fixtureFiles(LISTS_DIR)
    .filter((list) => wanted.length === 0 || wanted.includes(list.file))
    .map((list) => ({
      label: list.file,
      text: list.text,
      sizes: [
        [PHONE, EVERY_TAB],
        [DESKTOP, EVERY_TAB],
      ],
    }));
}

/** Made-up lists for every faction: each datasheet once, however many factions share it. */
async function everythingJobs(): Promise<Job[]> {
  const factions = FACTIONS.filter(
    (f) =>
      f.catalogue &&
      (wanted.length === 0 || wanted.some((w) => w.toLowerCase() === f.name.toLowerCase())),
  );
  // The stratagem deck is checked once, on the Stratagems tab, rather than in every deck too.
  const storage = {
    "army-cards:options": { stratagems: false },
    "army-cards:play": { phase: "all", turn: "both" },
  };
  const seen = new Set<string>();
  const seenEnhancements = new Set<string>();
  const jobs: Job[] = [];
  for (const faction of factions) {
    const bundle = await loadFactionBundle(faction.name);
    const units = Object.values(bundle.units).filter((unit) => {
      if (!isDatasheet(unit) || seen.has(unit.name)) return false;
      seen.add(unit.name);
      return true;
    });
    for (const loadout of ["default", "everything"] as Loadout[]) {
      for (const list of syntheticLists(bundle, units, loadout, seenEnhancements)) {
        jobs.push({
          label: list.label,
          text: list.text,
          units: list.units,
          storage,
          warnOnly: loadout === "everything",
          sizes:
            loadout === "default"
              ? [
                  [PHONE, ["Army", "Cards"]],
                  [DESKTOP, ["Cards", "Stratagems", "Rules"]],
                ]
              : [[DESKTOP, ["Cards"]]],
        });
      }
    }
  }
  return jobs;
}

/** A real datasheet, not a model or wargear BSData keeps at the top level. */
function isDatasheet(unit: UnitData): boolean {
  const models = Object.values(unit.models);
  const lines = [...unit.stats, ...models.flatMap((model) => model.stats)];
  return (
    Boolean(unit.wahapedia) || (models.length > 0 && lines.length > 0 && unit.keywords.length > 0)
  );
}

/** A made-up list must read back whole: every unit found, and no warning but the made-up prices. */
async function resolveCheck(job: Job): Promise<Finding[]> {
  if (job.units === undefined) return [];
  const findings: Finding[] = [];
  try {
    const { list, format, bundle } = await readList(job.text, loadFactionBundle);
    const army = buildArmy(list, bundle, {}, format);
    if (army.units.length !== job.units) {
      findings.push({ where: "reading", what: `${army.units.length} of ${job.units} units found` });
    }
    for (const warning of army.warnings.filter((w) => !EXPECTED_WARNING.test(w))) {
      findings.push({ where: "reading", what: warning });
    }
  } catch (error) {
    findings.push({ where: "reading", what: String(error).split("\n")[0] ?? "" });
  }
  return findings;
}

async function checkList(
  browser: Browser,
  job: Job,
  size: Size,
  tabs: string[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.mobile,
    hasTouch: size.mobile,
  });
  const page = await context.newPage();
  let tab = "load";
  const note = (what: string) => findings.push({ where: `${size.name} ${tab}`, what });
  // React logs "same key, `%s`" with the key as an argument; fill it in, and report each error once.
  const errors = new Set<string>();
  const pending: Promise<void>[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const where = tab;
    pending.push(
      Promise.all(message.args().map((arg) => arg.jsonValue().catch(() => "?"))).then((values) => {
        let next = 1;
        const text = String(values[0] ?? message.text()).replace(/%s/g, () =>
          String(values[next++] ?? ""),
        );
        const what = `console error: ${text.slice(0, 200)}`;
        if (errors.has(what)) return;
        errors.add(what);
        findings.push({ where: `${size.name} ${where}`, what });
      }),
    );
  });
  page.on("pageerror", (error) => note(`page error: ${String(error).slice(0, 160)}`));
  await page.addInitScript(
    ({ list, storage }) => {
      localStorage.setItem("army-cards:source", JSON.stringify({ text: list }));
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    // A list opens on Cards; start on Army, whose roster shows the list has loaded.
    { list: job.text, storage: { "army-cards:tab": "army", ...job.storage } },
  );

  try {
    await page.goto(APP);
    await page.locator("p.micro", { hasText: "Roster" }).first().waitFor({ timeout: LOAD_TIMEOUT });
    for (tab of tabs) {
      await page
        .locator("button:visible", { hasText: new RegExp(`^\\s*${tab}\\s*$`) })
        .first()
        .click();
      await page.evaluate(() => document.fonts.ready);
      // Let cards fit their text, and rules pages split, before measuring.
      // A printed deck renders a few sheets at a time (a phone shows a reflowed one instead).
      if (tab === "Cards" && !size.mobile) await page.locator("[data-deck-complete]").waitFor();
      await page.waitForTimeout(tab === "Cards" || tab === "Stratagems" ? 2000 : 500);
      for (const what of await page.evaluate(cutShort, size.mobile)) note(what);
    }
  } catch (error) {
    note(`did not finish: ${String(error).split("\n")[0]}`);
  }
  await Promise.all(pending);
  await context.close();
  return findings;
}

/** Runs in the page: every element whose text is cut short, described briefly. */
function cutShort(phone: boolean): string[] {
  const found: string[] = [];
  if (phone && document.documentElement.scrollWidth > window.innerWidth + 1) {
    found.push(
      `page ${document.documentElement.scrollWidth}px wide on a ${window.innerWidth}px screen`,
    );
  }
  for (const element of document.querySelectorAll<HTMLElement>("body *")) {
    const style = getComputedStyle(element);
    const text = `“${(element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60)}”`;
    if (style.textOverflow === "ellipsis" && element.scrollWidth > element.clientWidth + 1) {
      found.push(`ellipsis ${text}`);
    } else if (
      style.webkitLineClamp !== "none" &&
      style.webkitLineClamp !== "" &&
      element.scrollHeight > element.clientHeight + 1
    ) {
      found.push(`line clamp ${text}`);
    } else if (element.style.getPropertyValue("--fit")) {
      const columns = [...element.querySelectorAll<HTMLElement>("[data-fit-column]")];
      const over = Math.max(
        element.scrollHeight - element.clientHeight,
        element.scrollWidth - element.clientWidth,
        ...columns.map((column) => column.scrollHeight - column.clientHeight),
      );
      // Named by its card: the datasheet's or stratagem's name, or the rules card's title.
      const card = element.closest("article")?.querySelector("h2, h3")?.textContent?.trim();
      if (over > 1)
        found.push(
          `${card ? `${card}: ` : ""}${over}px over at ${element.style.getPropertyValue("--fit")}pt ${text}`,
        );
    }
  }
  return found;
}
