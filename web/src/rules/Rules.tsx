import { createContext, type ReactNode, use, useMemo, useState } from "react";
import { ruleKey } from "../../../shared/bundle";
import type { Ability } from "../../../shared/types";
import { Rich } from "../cards/parts";
import { BottomSheet } from "../ui/BottomSheet";

type Rules = {
  find: (name: string) => Ability | undefined;
  show: (rule: Ability, eyebrow?: string) => void;
};

const RulesContext = createContext<Rules>({ find: () => undefined, show: () => undefined });

/**
 * Makes every rule the army's cards name readable on screen: a term with text
 * behind it (Deep Strike, Rapid Fire 1, Acts of Faith) opens it on a tap.
 */
export function RulesProvider({
  glossary,
  children,
}: {
  glossary: Ability[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState<{ rule: Ability; eyebrow: string }>();
  const rules = useMemo<Rules>(() => {
    const byKey = new Map(glossary.map((rule) => [ruleKey(rule.name), rule]));
    return {
      find: (name) => byKey.get(ruleKey(name)),
      show: (rule, eyebrow = "Rule") => setOpen({ rule, eyebrow }),
    };
  }, [glossary]);

  return (
    <RulesContext value={rules}>
      {children}
      {open ? (
        <BottomSheet
          dialog
          eyebrow={open.eyebrow}
          title={open.rule.name}
          onClose={() => setOpen(undefined)}
        >
          <div className="rules-text px-1 pb-2 text-[14px] leading-relaxed text-ink-dim">
            <Rich html={open.rule.html} />
          </div>
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
