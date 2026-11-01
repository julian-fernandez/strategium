import { createContext, type ReactNode, use, useEffect, useMemo, useState } from "react";
import { ruleKey } from "../../../shared/bundle";
import { type CoreRule, termKey } from "../../../shared/coreRules";
import { linkRules, namePattern, type RuleIndex } from "../../../shared/ruleLinks";
import type { Ability } from "../../../shared/types";
import { fetchCoreRules } from "../api";
import { Rich } from "../cards/parts";
import { BottomSheet } from "../ui/BottomSheet";

/** Something to show under a rule's text, given a way to close the sheet (links to the units that have it). */
type Footer = (close: () => void) => ReactNode;

/** One rule in the sheet: `id` is how links in other texts name it. */
type Entry = { rule: Ability; eyebrow: string; footer?: Footer; id: string };

type Rules = {
  find: (name: string) => Ability | undefined;
  show: (rule: Ability, eyebrow?: string, footer?: Footer) => void;
  /** A rule's text with the names of other rules in it marked up to open them. */
  link: (html: string, self?: string) => string;
  /** Opens the rule a link names, over the one being read, with a way back. */
  follow: (id: string) => void;
};

const RulesContext = createContext<Rules>({
  find: () => undefined,
  show: () => undefined,
  link: (html) => html,
  follow: () => undefined,
});

/**
 * Makes rules readable on screen. A term on a card with text behind it (Deep
 * Strike, Rapid Fire 1, Acts of Faith) opens it on a tap, and so does a rule
 * named inside another rule's text: a weapon keyword ("[DEVASTATING
 * WOUNDS]"), another ability, or a core rule ("assault shooting (10.05)",
 * "critical hit"), read from Wahapedia's core rules. Following one stacks it
 * over the rule it came from, with a way back.
 */
export function RulesProvider({
  glossary,
  ruleBook,
  children,
}: {
  glossary: Ability[];
  ruleBook: Ability[];
  children: ReactNode;
}) {
  const [stack, setStack] = useState<Entry[]>([]);
  const [core, setCore] = useState<CoreRule[]>([]);

  useEffect(() => {
    fetchCoreRules().then(setCore, () => setCore([]));
  }, []);

  const rules = useMemo<Rules>(() => {
    const byKey = new Map(glossary.map((rule) => [ruleKey(rule.name), rule]));
    const book = new Map([...ruleBook, ...glossary].map((rule) => [ruleKey(rule.name), rule]));
    const coreById = new Map(core.map((rule) => [rule.id, rule]));
    const coreByName = new Map(core.map((rule) => [termKey(rule.name), rule]));
    const coreByTerm = new Map<string, CoreRule>();
    for (const rule of core) {
      for (const term of [...rule.terms, termKey(rule.name)]) {
        if (!coreByTerm.has(term)) coreByTerm.set(term, rule);
      }
    }

    // What a name in a text means: a core rule by the section number after it, an ability
    // or keyword the faction has, or a core rule by name ("critical hit", "mortal wounds").
    // A faction rule under a core rule's own name is misfiled (BSData has a Celestian
    // Sacresants rule named "Keywords"), so the core rule wins that name.
    const resolve = (name: string, section?: string): string | undefined => {
      if (section && coreById.has(section)) return `core:${section}`;
      const named = coreByName.get(termKey(name));
      if (named) return `core:${named.id}`;
      const key = ruleKey(name);
      if (book.has(key)) return `rule:${key}`;
      const term = termKey(name);
      for (const variant of [term, term.replace(/e?s$/, ""), `${term}s`]) {
        const rule = coreByTerm.get(variant);
        if (rule) return `core:${rule.id}`;
      }
      return undefined;
    };
    const index: RuleIndex = {
      resolve,
      names: namePattern(book.keys()),
      terms: namePattern(coreByTerm.keys()),
    };

    const entry = (id: string): Entry | undefined => {
      const split = id.indexOf(":");
      const key = id.slice(split + 1);
      if (id.startsWith("rule:")) {
        const rule = book.get(key);
        return rule && { rule, eyebrow: "Rule", id };
      }
      const rule = coreById.get(key);
      return (
        rule && {
          rule: { name: rule.name, html: rule.html },
          eyebrow: rule.section ? `Core rules · ${rule.section}` : "Core rules",
          id,
        }
      );
    };

    return {
      find: (name) => byKey.get(ruleKey(name)),
      show: (rule, eyebrow = "Rule", footer) =>
        setStack([{ rule, eyebrow, footer, id: `rule:${ruleKey(rule.name)}` }]),
      link: (html, self) => linkRules(html, index, self),
      follow: (id) => {
        const next = entry(id);
        if (next) setStack((current) => [...current, next]);
      },
    };
  }, [glossary, ruleBook, core]);

  const open = stack.at(-1);
  return (
    <RulesContext value={rules}>
      {children}
      {open ? (
        <BottomSheet
          // A followed link is a new sheet: it opens at its top, with focus on its controls.
          key={`${stack.length}:${open.id}`}
          dialog
          eyebrow={open.eyebrow}
          title={open.rule.name}
          onClose={() => setStack([])}
          onBack={stack.length > 1 ? () => setStack((current) => current.slice(0, -1)) : undefined}
        >
          <div className="rules-text px-1 pb-2 text-[14px] leading-relaxed text-ink-dim">
            <Rich html={open.rule.html} self={open.id} />
          </div>
          {open.footer?.(() => setStack([]))}
        </BottomSheet>
      ) : null}
    </RulesContext>
  );
}

export function useRules(): Rules {
  return use(RulesContext);
}

/**
 * A rule's name as it appears on a card ("Sustained Hits 1"). On screen it
 * opens the rule's text when the army's glossary has it; in print it's plain text.
 */
export function RuleTerm({ name }: { name: string }) {
  const { find, show } = useRules();
  const rule = find(name);
  if (!rule) return <>{name}</>;
  return (
    <button type="button" className="rule-term" onClick={() => show(rule)}>
      {name}
    </button>
  );
}

/** Several rule names in a row, each one readable on its own. */
export function RuleTerms({ names, separator = ", " }: { names: string[]; separator?: string }) {
  return (
    <>
      {names.map((name, index) => (
        <span key={name}>
          {index ? separator : null}
          <RuleTerm name={name} />
        </span>
      ))}
    </>
  );
}

/** An ability whose text is already in hand, such as a detachment rule: its name opens it. */
export function AbilityTerm({ ability, eyebrow }: { ability: Ability; eyebrow?: string }) {
  const { show } = useRules();
  if (!ability.html) return <>{ability.name}</>;
  return (
    <button type="button" className="rule-term" onClick={() => show(ability, eyebrow)}>
      {ability.name}
    </button>
  );
}
