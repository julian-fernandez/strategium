import { describe, expect, it } from "vitest";
import { bsdataToHtml, sanitizeWahapediaHtml } from "./markup";
import { whenLine } from "./stratagems";

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
});

describe("sanitizeWahapediaHtml", () => {
  it("keeps formatting and keyword spans, drops everything else", () => {
    expect(
      sanitizeWahapediaHtml(
        '<b>WHEN:</b> Fight phase.<br><span class="kwb">ADEPTA</span> <a href="x" onclick="y">link</a><img src=x>',
      ),
    ).toBe('<b>WHEN:</b> Fight phase.<br><span class="kw">ADEPTA</span> link');
  });
});
