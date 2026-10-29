/**
 * Prints the demo list's deck to PDF the way the browser would, for checking
 * page size, order, fit and color. Needs `pnpm dev` running.
 *
 *   pnpm print-check [output.pdf]
 *
 * Backgrounds print with the browser's default settings ("Background graphics"
 * off), so the check fails if the cards rely on that box being ticked.
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";

/**
 * The section bar colour, #3d4639, as a PDF fill (Chrome writes `.2392 .2745 .2235 rg`).
 * It is only ever a background, so it shows whether backgrounds made it to paper.
 */
const BAR_FILL = /0?\.239\d* 0?\.274\d* 0?\.223\d* rg/g;

const output = process.argv[2] ?? "print-check.pdf";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://localhost:5173/");
await page.getByRole("button", { name: "Load demo" }).click();
await page.getByRole("button", { name: "Cards", exact: true }).click();
await page.locator(".print-page").first().waitFor();
await page.evaluate(() => document.fonts.ready);
// Let the cards fit their text with the real fonts.
await page.waitForTimeout(500);

await page.emulateMedia({ media: "print" });
await page.pdf({ path: output, preferCSSPageSize: true, printBackground: false });
const pages = await page.locator(".print-page").count();
await browser.close();

const barFills = countBarFills(readFileSync(output));
console.log(`${pages} pages, ${barFills} section-bar fills -> ${output}`);
if (barFills === 0) {
  console.error(
    "No section-bar colour in the PDF: the cards would print without their backgrounds.",
  );
  process.exitCode = 1;
}

function countBarFills(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  let count = 0;
  for (const match of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const content = inflateSync(Buffer.from(match[1] ?? "", "latin1")).toString("latin1");
      count += content.match(BAR_FILL)?.length ?? 0;
    } catch {
      // Not a deflated content stream (fonts, images).
    }
  }
  return count;
}
