/**
 * Rules text arrives in two dialects: BSData's markdown-ish markup
 * (`**bold**`, `^^keyword^^`) and Wahapedia's HTML. Both end up as a small,
 * safe subset of HTML the cards render.
 */

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => escapes[char] ?? char);
}

const KEYWORD = '<span class="kw">$1</span>';

/**
 * BSData text to HTML: `^^Keyword^^` becomes a keyword span, `**x**` becomes
 * bold. The markers are sometimes interleaved (`^^**[Precision]^^**`), so a
 * match never runs across another marker. Some rules are hard-wrapped mid
 * sentence; a break that ends without punctuation and carries on in lower
 * case is joined back up, while list lines and paragraphs keep theirs.
 */
export function bsdataToHtml(text: string): string {
  return escapeHtml(text.trim().replace(/([^\s.:;!?)])[ \t]*\n(?=[a-z(])/g, "$1 "))
    .replace(/(?:\*\*\^\^|\^\^\*\*)([^*^]+?)(?:\*\*\^\^|\^\^\*\*)/g, KEYWORD)
    .replace(/\^\^([^*^]+?)\^\^/g, KEYWORD)
    .replace(/\*\*([^*]+?)\*\*/g, "<b>$1</b>")
    .replace(/\*\*|\^\^/g, "")
    .replace(/\n/g, "<br>");
}

const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "br", "p", "ul", "li", "span"]);

/**
 * Keeps Wahapedia's formatting tags and drops everything else, including every
 * attribute except a keyword class on spans.
 */
export function sanitizeWahapediaHtml(html: string): string {
  return html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, rawName: string, attributes: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (tag.startsWith("</")) return `</${name}>`;
    if (name === "span") {
      return /class="kw/.test(attributes) ? '<span class="kw">' : "<span>";
    }
    return name === "br" ? "<br>" : `<${name}>`;
  });
}

/** Plain text, for comparisons and compact lists. Line breaks and list items become spaces. */
export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/(?:p|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
