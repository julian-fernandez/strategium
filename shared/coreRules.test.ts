import { describe, expect, it } from "vitest";
import { parseCoreRules } from "./coreRules";

/** A cut of Wahapedia's core rules page: two terms in running text, and the tooltips they point at. */
const PAGE = `
<p>A unit that's <b><b><span class="tooltip00068" data-tooltip-content="#tooltip_content00068"><span class="tt kwbu">Unengaged</span></span></b></b>
can shoot using assault shooting (<span class="tooltip00134" data-tooltip-content="#tooltip_content00134"><span class="tt kwbu">10.05</span></span>)
and so can an <b><span class="tooltip00069" data-tooltip-content="#tooltip_content00068"><span class="tt kwbu">engaged</span> <span class="tt kwbu">unit</span></span></b>.</p>
<div class="tooltip_templates">
<span id="tooltip_content00068"><div class="tooltip_header">03.04 Engagement</div><a href="/core-rules/#Engagement"><div class="tooltip_link"></div></a><div style="clear:both"></div> A model’s <b>engagement range</b> is 2" around it.<br><ul><li>While a unit has no <b>engaged</b> models, it is <b>unengaged</b>.</li></ul><br><div class="blackComment"><div class="bcHeader">WHAT IS ENGAGEMENT?</div>Being close.</div></span>
<span id="tooltip_content00134"><div class=" BreakInsideAvoid"><div class="str11Wrap"><div class="str11BodyWrap"><div class="str11HeadBlock str11Name">CLOSE-QUARTERS SHOOTING<span class="h_number">10.06</span></div></div><div class="str11BodyWrap"><div class="str11TextWrap"><div class="str11Text"><b>ELIGIBLE IF:</b> Has one or more <span class="kwb">[PISTOL]</span> weapons.<div class="str11Line"></div><b>EFFECT:</b> Your unit shoots.</div></div><div class="str11Bg"><div class="str11Icon"></div></div></div></div></div></span>
</div>`;

describe("parseCoreRules", () => {
  const rules = parseCoreRules(PAGE);
  const rule = (id: string) => rules.find((r) => r.id === id);

  it("reads each tooltip's section, name and text", () => {
    expect(rule("03.04")).toMatchObject({ name: "Engagement", section: "03.04" });
    expect(rule("03.04")?.html).toBe(
      'A model’s <b>engagement range</b> is 2" around it.<ul><li>While a unit has no <b>engaged</b> models, it is <b>unengaged</b>.</li></ul><b>WHAT IS ENGAGEMENT?</b><br>Being close.',
    );
    expect(rule("10.06")).toMatchObject({ name: "Close-quarters Shooting", section: "10.06" });
    expect(rule("10.06")?.html).toBe(
      '<b>ELIGIBLE IF:</b> Has one or more <span class="kw">[PISTOL]</span> weapons.<br><b>EFFECT:</b> Your unit shoots.',
    );
  });

  it("files every term that points at a rule under it, but not bare section numbers", () => {
    expect(rule("03.04")?.terms.sort()).toEqual(["engaged unit", "unengaged"]);
    expect(rule("10.06")?.terms).toEqual([]);
  });

  it("writes a die drawn in CSS as its number, and drops arrow-only cells", () => {
    const [hitRoll] = parseCoreRules(
      `<span id="tooltip_content00092"><div class="tooltip_header">Hit Roll</div><table><tbody><tr><td><div class="img-inv"><img src="/img/ArrowRight.png"></div></td><td>Unmodified <div class="cruD6"></div></td><td><span class="kwb">CRITICAL HIT</span></td></tr></tbody></table></span>`,
    );
    expect(hitRoll?.html).toBe(
      '<table><tbody><tr><td>Unmodified 6</td><td><span class="kw">CRITICAL HIT</span></td></tr></tbody></table>',
    );
  });
});
