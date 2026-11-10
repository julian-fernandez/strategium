import { useRef, useState } from "react";
import type { Army } from "../../../shared/types";
import {
  COVER_MESSAGE_LIMIT,
  COVER_NAME_LIMIT,
  type CoverSettings,
  listTitle,
  pointsLine,
} from "../cards/cover";
import type { Cover } from "./useCover";

type Line = Exclude<keyof CoverSettings, "name" | "message" | "image">;

/** What goes on the cover: which of the list's lines, your message, and an image. */
export function CoverPanel({ army, cover }: { army: Army; cover: Cover }) {
  const { settings, image } = cover;
  const title = listTitle(army.note);
  // A list without a name can be given one here; its own name always wins.
  const given = settings.name.trim();
  const lines: { key: Line; label: string; value?: string; text: string }[] = [
    {
      key: "listName",
      label: "List name",
      value: title ?? (given || undefined),
      text: title ?? "The list doesn't have one, so you can give it one:",
    },
    {
      key: "detachments",
      label: "Detachments",
      value: army.detachments.length ? army.detachments.join(" · ") : undefined,
      text: army.detachments.join(" · ") || "This list doesn't have one.",
    },
    { key: "points", label: "Points", value: pointsLine(army), text: pointsLine(army) },
  ];
  const picker = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  // The thumbnail that didn't load, so a bad link says so.
  const [broken, setBroken] = useState<string>();
  const linkable = /^(?:https?:\/\/|data:image\/)/i.test(url.trim());

  return (
    <section className="no-print bg-panel hairline">
      <div className="border-b border-line px-4 py-3 md:px-6">
        <p className="micro">{"// "}Cover</p>
      </div>
      <div className="grid grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]">
        <fieldset className="flex min-w-0 flex-col gap-2" aria-label="Cover lines">
          <span className="micro">Show</span>
          {lines.map((line) => (
            <div key={line.key} className="flex min-w-0 flex-col gap-2">
              <button
                type="button"
                disabled={!line.value}
                onClick={() => cover.change({ [line.key]: !settings[line.key] })}
                aria-pressed={settings[line.key]}
                className="flex min-w-0 items-start gap-3 text-left disabled:cursor-default disabled:opacity-45"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-line-strong">
                  {settings[line.key] && line.value ? <span className="h-2 w-2 bg-ink" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold uppercase tracking-[0.14em]">
                    {line.label}
                  </span>
                  <span className="mt-0.5 block break-words text-[12px] leading-relaxed text-ink-dim">
                    {line.text}
                  </span>
                </span>
              </button>
              {line.key === "listName" && !title ? (
                <input
                  value={settings.name}
                  maxLength={COVER_NAME_LIMIT}
                  onChange={(event) => cover.change({ name: event.target.value })}
                  placeholder="Name this list"
                  aria-label="Name this list"
                  className="ml-7 h-9 min-w-0 bg-panel-strong px-3 text-[13px] text-ink placeholder:text-ink-faint hairline focus:border-line-strong focus:outline-none"
                />
              ) : null}
            </div>
          ))}
        </fieldset>

        <label className="flex min-w-0 flex-col gap-2">
          <span className="micro">Message</span>
          <textarea
            value={settings.message}
            maxLength={COVER_MESSAGE_LIMIT}
            onChange={(event) => cover.change({ message: event.target.value })}
            placeholder="Optional: a line or two under the list's name."
            className="h-[132px] w-full resize-none bg-panel-strong p-3 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint hairline transition-colors duration-150 focus:border-line-strong focus:outline-none"
          />
          <span className="text-right text-[11px] text-ink-faint">
            {settings.message.length} / {COVER_MESSAGE_LIMIT}
          </span>
        </label>

        <div className="flex min-w-0 flex-col gap-2">
          <span className="micro">Image</span>
          {settings.image ? (
            <div className="flex items-start gap-3">
              {image && image !== broken ? (
                <img
                  src={image}
                  alt="On the cover"
                  onError={() => setBroken(image)}
                  className="h-20 max-w-[140px] shrink-0 object-contain hairline"
                />
              ) : (
                <p className="text-[12px] leading-relaxed text-ink-dim">
                  {settings.image.kind === "link"
                    ? "This link didn't load an image, so the cover goes without."
                    : "Loading…"}
                </p>
              )}
              <button type="button" className="btn ml-auto shrink-0" onClick={cover.removeImage}>
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => picker.current?.click()}
            >
              {busy ? "Saving…" : "Upload image"}
            </button>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setBusy(true);
                await cover.upload(file);
                setBusy(false);
              }}
            />
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!linkable) return;
              cover.link(url.trim());
              setUrl("");
            }}
          >
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="or an image link, https://…"
              aria-label="Image link"
              className="h-10 min-w-0 flex-1 bg-panel-strong px-3 text-[13px] text-ink placeholder:text-ink-faint hairline focus:border-line-strong focus:outline-none"
            />
            <button type="submit" className="btn shrink-0" disabled={!linkable}>
              Use link
            </button>
          </form>
          {cover.error ? <p className="text-[12px] text-seal">{cover.error}</p> : null}
          <p className="text-[12px] leading-relaxed text-ink-dim">
            An upload is kept in this browser only. A link has to still work when you print.
          </p>
        </div>
      </div>
    </section>
  );
}
