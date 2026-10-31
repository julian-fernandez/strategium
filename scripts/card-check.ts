/**
 * Loads every fixture list in the running app and checks that no text is cut
 * short: no card's text spilling past its box at its smallest size, nothing on
 * screen ending in an ellipsis or a line clamp, on a phone and on a desktop,
 * on every tab a list shows. Console errors count too. Needs `pnpm dev` running.
 *
 *   pnpm card-check                    every list in fixtures/lists
 *   pnpm card-check orks.txt tau.txt   just these
 */
import { type Browser, chromium } from "playwright";
import { fixtureFiles, LISTS_DIR } from "../fixtures";

const APP = "http://localhost:5173/";
const PARALLEL = 4;
/** The first load of a faction compiles its bundle, which can take a while. */
const LOAD_TIMEOUT = 120_000;
const SIZES = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1440, height: 900, mobile: false },
];
/** Cards comes right after Army: on a phone it's a button on the Army tab, not in the tab bar. */
const TABS = ["Army", "Cards", "Play", "Stratagems", "Rules"];

type Finding = { where: string; what: string };

const wanted = process.argv.slice(2);
const lists = fixtureFiles(LISTS_DIR).filter(
  (list) => wanted.length === 0 || wanted.includes(list.file),
);

try {
  await fetch(APP);
} catch {
  console.error(`Nothing is running at ${APP}. Start \`pnpm dev\` first.`);
  process.exit(1);
}

const browser = await chromium.launch();
const results = new Map<string, Finding[]>();
const queue = [...lists];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let list = queue.shift(); list; list = queue.shift()) {
      const findings: Finding[] = [];
      for (const size of SIZES) findings.push(...(await checkList(browser, list.text, size)));
      results.set(list.file, findings);
      console.log(`${findings.length ? "✗" : "✓"} ${list.file}`);
      for (const finding of findings) console.log(`    ${finding.where}: ${finding.what}`);
    }
  }),
);
await browser.close();

const failed = [...results.values()].filter((findings) => findings.length).length;
console.log(
  failed
    ? `\n${failed} of ${results.size} lists have text cut short or console errors.`
    : `\nAll ${results.size} lists: no text cut short, no console errors.`,
);
if (failed) process.exitCode = 1;

async function checkList(
  browser: Browser,
  text: string,
  size: (typeof SIZES)[number],
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
  page.on("console", (message) => {
    if (message.type() === "error") note(`console error: ${message.text().slice(0, 160)}`);
  });
  page.on("pageerror", (error) => note(`page error: ${String(error).slice(0, 160)}`));
  await page.addInitScript((list) => {
    localStorage.setItem("army-cards:source", JSON.stringify({ text: list }));
  }, text);

  try {
    await page.goto(APP);
    await page.locator("p.micro", { hasText: "Roster" }).first().waitFor({ timeout: LOAD_TIMEOUT });
    for (tab of TABS) {
      await page
        .locator("button:visible", { hasText: new RegExp(`^\\s*${tab}\\s*$`) })
        .first()
        .click();
      await page.evaluate(() => document.fonts.ready);
      // Let cards fit their text, and rules pages split, before measuring.
      await page.waitForTimeout(tab === "Cards" ? 2000 : 500);
      for (const what of await page.evaluate(cutShort)) note(what);
    }
  } catch (error) {
    note(`did not finish: ${String(error).split("\n")[0]}`);
  }
  await context.close();
  return findings;
}

/** Runs in the page: every element whose text is cut short, described briefly. */
function cutShort(): string[] {
  const found: string[] = [];
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
      if (over > 1)
        found.push(`${over}px over at ${element.style.getPropertyValue("--fit")}pt ${text}`);
    }
  }
  return found;
}
