/**
 * What `linkRules` knows. `resolve` says which rule a name means, given the
 * section number written after it if there is one, and returns nothing for a
 * name it doesn't know. `names` and `terms` (from `namePattern`) find rule
 * names in plain text as well, which BSData writes without markup.
 */
export type RuleIndex = {
  resolve: (name: string, section?: string) => string | undefined;
  /** The army's rules: "the Lethal Hits ability", "- Sustained Hits 1". */
  names?: RegExp;
  /** The core rules' terms: "a Charge move", "can Advance". */
  terms?: RegExp;
};

/**
 * Marks up the names of other rules inside a rule's text, so they open on a
 * tap: a bold term ("critical hit", "assault shooting (10.05)"), a weapon
 * keyword in brackets ("[DEVASTATING WOUNDS]"), or a rule named in plain text
 * the way GW writes one, with a capital ("Lethal Hits", "Charge move"). `self`
 * is the rule being read, which needn't link to itself.
 */
export function linkRules(html: string, index: RuleIndex, self?: string): string {
  const marked = html.replace(
    /<b>([^<]{3,60})<\/b>(\s*\((\d{2}(?:\.\d{2})*)\))?|\[([A-Z][A-Za-z0-9 +-]{1,40})\]/g,
    (whole, bold: string | undefined, after: string | undefined, section, bracket) => {
      const name = (bold ?? bracket ?? "").replace(/^\[|\]$/g, "");
      const id = index.resolve(name, section);
      if (!id || id === self) return whole;
      return bold !== undefined
        ? `<b>${button(id, bold)}</b>${after ?? ""}`
        : `[${button(id, bracket)}]`;
    },
  );
  const plain = linkPlain(marked, index.names, false, index.resolve, self);
  return linkPlain(plain, index.terms, true, index.resolve, self);
}

/**
 * A pattern that finds any of these rule names in plain text, longest first,
 * with the number some carry ("Sustained Hits 1", "Feel No Pain 5+",
 * "Anti-Infantry 4+"). A hyphen and a space are the same ("Battle-shock",
 * "Fall Back"). Names that aren't plain words ("a (unit/model/object)") are
 * left out.
 */
export function namePattern(names: Iterable<string>): RegExp | undefined {
  const words = new Set<string>();
  for (const name of names) {
    const parts = name.toLowerCase().split(/[\s-]+/);
    if (parts.every((part) => /^[a-z][a-z'’]*$/.test(part))) words.add(parts.join("[\\s-]+"));
  }
  // Every Anti- rule is filed as "anti".
  if (words.delete("anti")) words.add("anti-[a-z]+");
  if (!words.size) return undefined;
  const alternatives = [...words].sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?<![\\w'’-])(?:${alternatives.join("|")})(?:\\s+(?:\\d*d\\d+(?:\\+\\d+)?|\\d+)\\+?)?(?![\\w'’-])`,
    "gi",
  );
}

/** Words that open a sentence, so the name after them can be capitalised for that. */
const OPENERS = new Set(
  "a an the this that these those each every when while if until after before once at in on for its their your any all".split(
    " ",
  ),
);

/**
 * Links the names `pattern` finds in the text between tags, outside links
 * already made. A name counts only when it's capitalised (a keyword is in
 * capitals, and a lower-case word is just a word) and stands on its own: not
 * part of a longer name ("Assault Intercessors", "Wolf Scouts"). A one-word
 * core term must also be mid-sentence ("can Advance"): opening a sentence,
 * "Hidden" or "Destroyed" is just a word.
 */
function linkPlain(
  html: string,
  pattern: RegExp | undefined,
  midSentence: boolean,
  resolve: RuleIndex["resolve"],
  self: string | undefined,
): string {
  if (!pattern) return html;
  let linked = 0;
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<button\b/.test(part)) linked++;
        else if (part === "</button>") linked--;
        return part;
      }
      if (linked > 0) return part;
      return part.replace(pattern, (name: string, offset: number) => {
        if (!/^[A-Z]/.test(name) || !/[a-z]/.test(name)) return name;
        if (/^\s+[A-Z][a-z]/.test(part.slice(offset + name.length))) return name;
        const previous = /([A-Za-z][\w'’-]*)\s+$/.exec(part.slice(0, offset))?.[1];
        if (previous && /^[A-Z]/.test(previous) && !OPENERS.has(previous.toLowerCase())) {
          return name;
        }
        if (midSentence && !/[\s-]/.test(name) && !(previous && /^[a-z]/.test(previous))) {
          return name;
        }
        const id = resolve(name);
        return id && id !== self ? button(id, name) : name;
      });
    })
    .join("");
}

function button(id: string, text: string): string {
  return `<button type="button" class="rule-term" data-rule="${attribute(id)}">${text}</button>`;
}

function attribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
