import type { ReactNode } from "react";
import type { Army } from "../../../shared/types";
import { AbilityTerm } from "./Rules";

/**
 * The army rules card, for the screen: the army rule, each detachment's rules
 * and the enhancements taken, each name opening its text.
 */
export function ArmyRulesPanel({ army }: { army: Army }) {
  const { rules, detachments, enhancements } = army.armyRules;
  if (!rules.length && !detachments.length && !enhancements.length) return null;

  return (
    <section className="bg-panel hairline">
      <h2 className="micro border-b border-line px-5 py-3 text-ink">{"// "}Army rules</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-[14px] sm:grid-cols-[max-content_1fr]">
        {rules.length ? (
          <Row label="Army rule">
            {rules.map((rule) => (
              <AbilityTerm key={rule.name} ability={rule} eyebrow="Army rule" />
            ))}
          </Row>
        ) : null}
        {detachments.map((detachment) => (
          <Row key={detachment.name} label={detachment.name}>
            {detachment.rules.map((rule) => (
              <AbilityTerm key={rule.name} ability={rule} eyebrow={detachment.name} />
            ))}
          </Row>
        ))}
        {enhancements.length ? (
          <Row label="Enhancements">
            {enhancements.map((enhancement) => (
              <span key={enhancement.name}>
                <AbilityTerm ability={enhancement} eyebrow={enhancement.bearer} />
                <span className="text-ink-faint">
                  {" "}
                  · {enhancement.bearer}
                  {enhancement.cost ? ` · ${enhancement.cost} pts` : ""}
                </span>
              </span>
            ))}
          </Row>
        ) : null}
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="micro self-baseline">{label}</dt>
      <dd className="flex flex-wrap gap-x-4 gap-y-1 font-semibold">{children}</dd>
    </>
  );
}
