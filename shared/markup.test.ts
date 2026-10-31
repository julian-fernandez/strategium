import { describe, expect, it } from "vitest";
import { ruleKey } from "./bundle";
import { bsdataToHtml, sanitizeWahapediaHtml } from "./markup";
import { boldLabels, usersOf, whenLine } from "./stratagems";

describe("bsdataToHtml", () => {
  it("keeps interleaved markers from swallowing the text between keywords", () => {
    const html = bsdataToHtml(
      "that attack has the ^^**[Precision]^^** ability and you can re‑roll the Hit roll. This ability can be used even if this unit is embarked within a ^^**Transport**^^.",
    );
    expect(html).toBe(
      'that attack has the <span class="kw">[Precision]</span> ability and you can re‑roll the Hit roll. This ability can be used even if this unit is embarked within a <span class="kw">Transport</span>.',
    );
  });

  it("handles plain keywords, bold and line breaks, and escapes HTML", () => {
    expect(bsdataToHtml("**Bold** and ^^Infantry^^\n<script>")).toBe(
      '<b>Bold</b> and <span class="kw">Infantry</span><br>&lt;script&gt;',
    );
  });

  it("underlines BSData's <ins> and keeps other angle brackets as text", () => {
    expect(
      bsdataToHtml(
        "- <ins>Or:</ins> With -2 to that **battle-shock roll** if this unit has 13+ models. Each <FACTION> unit.",
      ),
    ).toBe(
      "- <u>Or:</u> With -2 to that <b>battle-shock roll</b> if this unit has 13+ models. Each &lt;FACTION&gt; unit.",
    );
  });
});

describe("bsdataToHtml line breaks", () => {
  it("joins a hard wrap mid-sentence but keeps list lines and paragraph breaks", () => {
    expect(
      bsdataToHtml(
        "only a single dice can\nbe substituted.\n\nGAINING DICE\n- At the start\n■ Hit roll",
      ),
    ).toBe(
      "only a single dice can be substituted.<br><br>GAINING DICE<br>- At the start<br>■ Hit roll",
    );
  });

  it("shrinks runs of blank lines, and keeps none before a list", () => {
    expect(
      bsdataToHtml(
        "unit can:\n\n\n- Re-roll hit rolls of 1.\n- Re-roll wound rolls of 1.\n\n\n\nNext.",
      ),
    ).toBe("unit can:<br>- Re-roll hit rolls of 1.<br>- Re-roll wound rolls of 1.<br><br>Next.");
  });
});

describe("whenLine", () => {
  it("turns a bulleted list into a comma-separated one", () => {
    expect(
      whenLine(
        "<b>WHEN:</b> Any phase, just after you make one of the following rolls:<br><ul><li><b>Advance roll</b></li><li><b>Hit roll</b></li><li>A roll to determine the number of attacks.</li></ul><br><b>TARGET:</b> That unit.",
      ),
    ).toBe(
      "Any phase, just after you make one of the following rolls: Advance roll, Hit roll, A roll to determine the number of attacks.",
    );
  });

  it("stops at the next labelled section", () => {
    expect(whenLine("<b>WHEN:</b> Fight phase.<br><br><b>TARGET:</b> One unit.")).toBe(
      "Fight phase.",
    );
  });

  it("reads a label written outside the bold, or not bold at all", () => {
    expect(whenLine("<b>WHEN</b>: Shooting phase.<br><br><b>TARGET:</b> One unit.")).toBe(
      "Shooting phase.",
    );
    expect(whenLine("WHEN: Your Movement phase.<br><br>TARGET: One unit.")).toBe(
      "Your Movement phase.",
    );
  });
});

describe("boldLabels", () => {
  it("writes every section label as <b>LABEL:</b>", () => {
    expect(boldLabels("WHEN: Now.<br><br><b>EFFECT</b>: Then.")).toBe(
      "<b>WHEN:</b> Now.<br><br><b>EFFECT:</b> Then.",
    );
  });
});

describe("sanitizeWahapediaHtml", () => {
  it("keeps formatting and keyword spans, drops everything else", () => {
    expect(
      sanitizeWahapediaHtml(
        '<b>WHEN:</b> Fight phase.<br><span class="kwb">ADEPTA</span> <a href="x" onclick="y">link</a><img src=x>',
      ),
    ).toBe('<b>WHEN:</b> Fight phase.<br><span class="kw">ADEPTA</span> link');
  });

  it("leaves one blank line where a picture of a table was", () => {
    expect(
      sanitizeWahapediaHtml(
        'Range:<br><br><div><img src="a.png"></div><br><div><img src="b.png"></div><br><br>Max 12".',
      ),
    ).toBe('Range:<br><br>Max 12".');
  });
});

describe("ruleKey", () => {
  it("files a rule under its name, without its value or a condition after a colon", () => {
    expect(ruleKey("Feel No Pain 5+")).toBe("feel no pain");
    expect(ruleKey("Anti-PSYKER 4+")).toBe("anti");
    expect(ruleKey("Deadly Demise 2D6+6")).toBe("deadly demise");
    expect(ruleKey('Scouts D6+4"')).toBe("scouts");
    expect(ruleKey("Sustained Hits 1: non-MONSTER/VEHICLE")).toBe("sustained hits");
    expect(ruleKey("Lethal Hits: MONSTER/VEHICLE")).toBe("lethal hits");
    expect(ruleKey("Rapid Fire D3")).toBe("rapid fire");
  });
});

describe("usersOf", () => {
  const users = (usableBy: string[], notUsableBy: string[], everyUnit = false) =>
    usersOf({ usableBy, notUsableBy, everyUnit });

  it("names the few units that can't, when that's shorter than the ones that can", () => {
    expect(users(["A", "B", "C"], [], true)).toBe("Every unit");
    expect(users(["A", "B", "C"], ["D"])).toBe("Every unit except D");
    expect(users(["A"], ["B", "C"])).toBe("A");
    expect(users([], [])).toBe("");
  });
});
