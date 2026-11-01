/**
 * The core rules, read from Wahapedia's core rules page, so a rule's text can
 * open the core rule it names: "assault shooting (10.05)", "critical hit",
 * "mortal wounds". The page marks every such term with a tooltip holding the
 * rule; each tooltip becomes one entry, with every term that points at it.
 */
export type CoreRule = {
  /** The section number ("10.05"), or the name in lower case when it has none. */
  id: string;
  name: string;
  section?: string;
  html: string;
  /** The words that point at it in rule texts, in lower case: "critical hit", "unengaged". */
  terms: string[];
};

export function parseCoreRules(page: string): CoreRule[] {
  const terms = new Map<string, Set<string>>();
  for (const match of page.matchAll(
    /<span class="tooltip\d+" data-tooltip-content="#tooltip_content(\d+)">([\s\S]*?)<\/span><\/span>/g,
  )) {
    const term = termKey(match[2]?.replace(/<[^>]+>/g, " ") ?? "");
    // A bare section number ("10.05") points at its section, which is found by number anyway.
    if (!/[a-z]/.test(term)) continue;
    const id = match[1] ?? "";
    terms.set(id, (terms.get(id) ?? new Set()).add(term));
  }

  const rules = new Map<string, CoreRule>();
  for (const match of page.matchAll(/<(span|div) id="tooltip_content(\d+)">/g)) {
    const rule = readRule(contents(page, (match.index ?? 0) + match[0].length, match[1] ?? "div"));
    if (!rule) continue;
    const words = terms.get(match[2] ?? "") ?? new Set<string>();
    const known = rules.get(rule.id);
    if (known) known.terms = [...new Set([...known.terms, ...words])];
    else rules.set(rule.id, { ...rule, terms: [...words] });
  }
  return [...rules.values()];
}

/**
 * A term as rule texts and the page both write it, for comparing: lower case,
 * plain quotes, and a hyphen the same as a space ("fall-back", "Fall Back").
 */
export function termKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[\s–-]+/g, " ")
    .trim();
}

/** One tooltip's rule: its number and name from its header, and its text. */
function readRule(content: string): Omit<CoreRule, "terms"> | undefined {
  let name: string | undefined;
  let section: string | undefined;
  const header = /<div class="tooltip_header">([^<]*)<\/div>/.exec(content)?.[1]?.trim();
  const block =
    /class="str11HeadBlock str11Name"[^>]*>([^<]+)<span class="h_number">([\d.]+)<\/span>/.exec(
      content,
    );
  if (header) {
    const numbered = /^(\d{2}(?:\.\d{2})*)\s+(.+)$/.exec(header);
    section = numbered?.[1];
    name = numbered?.[2] ?? header;
  } else if (block) {
    name = titleCase(block[1] ?? "");
    section = block[2];
  }
  if (!name) return undefined;
  const body = content
    .replace(/<div class="tooltip_header">[^<]*<\/div>/, "")
    .replace(/<a [^>]*><div class="tooltip_link"><\/div><\/a>/, "")
    .replace(/<div[^>]*str11HeadBlock[^>]*>[^<]*<span class="h_number">[^<]*<\/span><\/div>/, "");
  const html = cleanHtml(body);
  return html ? { id: section ?? termKey(name), name, section, html } : undefined;
}

const KEPT_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
]);
const BLOCK_TAGS = "ul|ol|li|table|thead|tbody|tr|td|th";

/**
 * The page's layout markup down to the formatting the app keeps (bold, lists,
 * tables, keyword spans). A block that ends becomes a line break; a run of
 * breaks becomes one blank line. Every other span (the page's tooltips) goes,
 * so a term reads `<b>advance move</b>` as it does in any other rule's text.
 */
function cleanHtml(html: string): string {
  // Which open spans were kept, so each closing tag goes with its own.
  const spans: boolean[] = [];
  return (
    html
      // A die drawn in CSS ("Unmodified ⚀") is its number; a cell holding only an arrow goes.
      .replace(/\s*<div class="cruD(\d+)"><\/div>/g, " $1")
      .replace(
        /<td[^>]*>\s*<div class="img-inv">\s*<img[^>]*ArrowRight[^>]*>\s*<\/div>\s*<\/td>/g,
        "",
      )
      .replace(/<div class="bcHeader">([\s\S]*?)<\/div>/g, "<b>$1</b><br>")
      .replace(/<\/div>/g, "<br>")
      .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, rawName: string, attributes: string) => {
        const name = rawName.toLowerCase();
        if (name === "span") {
          if (tag.startsWith("</")) return spans.pop() ? "</span>" : "";
          const keyword = /class="kwb/.test(attributes);
          spans.push(keyword);
          return keyword ? '<span class="kw">' : "";
        }
        if (!KEPT_TAGS.has(name)) return "";
        return tag.startsWith("</") ? `</${name}>` : `<${name}>`;
      })
      .replace(/<b>(?:\s*<b>)+/g, "<b>")
      .replace(/(?:<\/b>\s*)+<\/b>/g, "</b>")
      .replace(new RegExp(`(?:\\s*<br>)+\\s*(</?(?:${BLOCK_TAGS})>)`, "g"), "$1")
      .replace(new RegExp(`(</?(?:${BLOCK_TAGS})>)(?:\\s*<br>)+`, "g"), "$1")
      .replace(/(?:<br>\s*){3,}/g, "<br><br>")
      .replace(/^(?:\s*<br>)+|(?:<br>\s*)+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** What's inside the element that begins just before `start`, however deeply its own kind nests. */
function contents(page: string, start: number, tag: string): string {
  const tags = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  tags.lastIndex = start;
  let depth = 1;
  for (let match = tags.exec(page); match; match = tags.exec(page)) {
    depth += match[0] === `</${tag}>` ? -1 : 1;
    if (depth === 0) return page.slice(start, match.index);
  }
  return page.slice(start);
}

/** "CLOSE-QUARTERS SHOOTING" → "Close-quarters Shooting". */
function titleCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());
}
