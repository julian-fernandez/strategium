import { useState } from "react";
import { DEMO_LIST_URL, type ListSource } from "../api";

export function LoadPanel({
  initialText,
  loading,
  error,
  onLoad,
  onCancel,
}: {
  initialText?: string;
  loading: boolean;
  error?: string;
  onLoad: (source: ListSource) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [url, setUrl] = useState("");

  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-[1fr_340px] gap-6">
      <section className="bg-panel hairline">
        <div className="border-b border-line px-6 py-4">
          <p className="micro">{"// "}Step I</p>
          <h2 className="mt-1 text-[20px] font-extrabold uppercase tracking-[0.04em]">
            Paste your list
          </h2>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ink-dim">
            Copy the text export from New Recruit or the Warhammer 40,000 app. Every weapon, model
            count and enhancement in it ends up on the cards.
          </p>
        </div>
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) onLoad({ text });
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            placeholder={
              "Adepta Sororitas\nChampions of Faith (2 Detachment Points)\nTake and Hold\nStrike Force (2,000 Points)\n\nCHARACTERS\n…"
            }
            className="h-[340px] w-full resize-none bg-panel-strong p-4 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint hairline focus:border-line-strong focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-action" disabled={loading || !text.trim()}>
              {loading ? "Loading…" : "Build cards"}
            </button>
            {onCancel ? (
              <button type="button" className="btn" onClick={onCancel}>
                Back to army
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <aside className="flex flex-col gap-6">
        <section className="bg-panel p-6 hairline">
          <p className="micro">{"// "}Or link it</p>
          <h3 className="mt-1 text-[15px] font-bold uppercase tracking-[0.12em]">Listhammer</h3>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (url.trim()) onLoad({ url: url.trim() });
            }}
          >
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://listhammer.info/list/…"
              className="h-10 bg-panel-strong px-3 text-[13px] text-ink placeholder:text-ink-faint hairline focus:border-line-strong focus:outline-none"
            />
            <button type="submit" className="btn" disabled={loading || !url.trim()}>
              Load link
            </button>
          </form>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-dim">
            Linked lists are fetched again whenever the cards reload, so edits there show up here.
          </p>
        </section>

        <section className="bg-panel p-6 hairline">
          <p className="micro">{"// "}Try it</p>
          <h3 className="mt-1 text-[15px] font-bold uppercase tracking-[0.12em]">Demo list</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
            Adepta Sororitas, 5–0 at 40k Canteen Brawl 2026. Strike Force, two detachments, four
            attached units.
          </p>
          <button
            type="button"
            className="btn mt-4 w-full"
            disabled={loading}
            onClick={() => onLoad({ url: DEMO_LIST_URL })}
          >
            Load demo
          </button>
        </section>

        {error ? (
          <p
            className="border-l-2 border-seal bg-panel px-4 py-3 text-[13px] leading-relaxed"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
