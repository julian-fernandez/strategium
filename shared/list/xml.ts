/**
 * Just enough XML for roster files: elements and their attributes. Text
 * content, comments, CDATA, processing instructions and doctypes are skipped.
 * Runs anywhere (Web Worker, Node), so it doesn't lean on `DOMParser`.
 */

export type XmlElement = {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Decodes the five XML entities and numeric references. Unknown entities are left as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][\w.-]*);/g, (match, ref: string) => {
    if (ref.startsWith("#")) {
      const hex = ref[1] === "x" || ref[1] === "X";
      const code = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return Object.hasOwn(NAMED_ENTITIES, ref) ? (NAMED_ENTITIES[ref] ?? match) : match;
  });
}

const NAME_END = /[\s/>=]/;

/**
 * Parses a document and returns its root element. Throws on input that isn't
 * well-formed enough to read: unclosed or mismatched tags, a broken attribute,
 * or no root element at all.
 */
export function parseXml(text: string): XmlElement {
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let i = 0;

  while (i < text.length) {
    const open = text.indexOf("<", i);
    if (open === -1) break;

    if (text.startsWith("<!--", open)) {
      i = skipPast(text, "-->", open + 4, "a comment");
      continue;
    }
    if (text.startsWith("<![CDATA[", open)) {
      i = skipPast(text, "]]>", open + 9, "a CDATA section");
      continue;
    }
    if (text.startsWith("<?", open)) {
      i = skipPast(text, "?>", open + 2, "the XML declaration");
      continue;
    }
    if (text.startsWith("<!", open)) {
      i = skipDeclaration(text, open + 2);
      continue;
    }

    if (text[open + 1] === "/") {
      const close = text.indexOf(">", open);
      if (close === -1) throw new Error(`An end tag at offset ${open} is never closed.`);
      const name = text.slice(open + 2, close).trim();
      const element = stack.pop();
      if (!element) throw new Error(`Found </${name}> with no element open.`);
      if (element.name !== name) {
        throw new Error(`Found </${name}> where </${element.name}> was expected.`);
      }
      i = close + 1;
      continue;
    }

    const { element, selfClosing, end } = readStartTag(text, open);
    const parent = stack.at(-1);
    if (parent) parent.children.push(element);
    else if (root) throw new Error(`Found a second root element, <${element.name}>.`);
    else root = element;
    if (!selfClosing) stack.push(element);
    i = end;
  }

  const unclosed = stack.at(-1);
  if (unclosed) throw new Error(`<${unclosed.name}> is never closed.`);
  if (!root) throw new Error("The document has no root element.");
  return root;
}

/** The index just past the next `marker` at or after `from`. */
function skipPast(text: string, marker: string, from: number, what: string): number {
  const end = text.indexOf(marker, from);
  if (end === -1) throw new Error(`${capitalise(what)} is never closed.`);
  return end + marker.length;
}

/** Skips `<!DOCTYPE …>`, including an internal subset in square brackets. */
function skipDeclaration(text: string, from: number): number {
  let depth = 0;
  let quote = "";
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;
    } else if (char === ">" && depth <= 0) {
      return i + 1;
    }
  }
  throw new Error("A <!DOCTYPE> declaration is never closed.");
}

function readStartTag(
  text: string,
  open: number,
): { element: XmlElement; selfClosing: boolean; end: number } {
  let i = open + 1;
  const name = readName(text, i);
  if (!name) throw new Error(`Expected a tag name at offset ${open}.`);
  i += name.length;

  const attributes: Record<string, string> = Object.create(null);
  for (;;) {
    i = skipSpace(text, i);
    const char = text[i];
    if (char === undefined) throw new Error(`<${name}> is never closed.`);
    if (char === ">") {
      return { element: { name, attributes, children: [] }, selfClosing: false, end: i + 1 };
    }
    if (char === "/" && text[i + 1] === ">") {
      return { element: { name, attributes, children: [] }, selfClosing: true, end: i + 2 };
    }

    const attribute = readName(text, i);
    if (!attribute) throw new Error(`Unexpected "${char}" in <${name}>.`);
    i = skipSpace(text, i + attribute.length);
    if (text[i] !== "=") throw new Error(`Attribute "${attribute}" in <${name}> has no value.`);
    i = skipSpace(text, i + 1);
    const quote = text[i];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`Attribute "${attribute}" in <${name}> isn't quoted.`);
    }
    const close = text.indexOf(quote, i + 1);
    if (close === -1) throw new Error(`Attribute "${attribute}" in <${name}> is never closed.`);
    attributes[attribute] = normaliseAttribute(text.slice(i + 1, close));
    i = close + 1;
  }
}

function readName(text: string, from: number): string {
  let end = from;
  while (end < text.length && !NAME_END.test(text[end] ?? "")) end++;
  return text.slice(from, end);
}

function skipSpace(text: string, from: number): number {
  let i = from;
  while (i < text.length && /\s/.test(text[i] ?? "")) i++;
  return i;
}

/** XML turns literal tabs and line breaks in an attribute into spaces; encoded ones survive. */
function normaliseAttribute(raw: string): string {
  return decodeEntities(raw.replace(/\r\n?/g, "\n").replace(/[\t\n]/g, " "));
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
