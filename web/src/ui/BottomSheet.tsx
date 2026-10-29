import { type ReactNode, useEffect, useRef } from "react";

/**
 * A full-height sheet over the page, for phones: a title bar with a close
 * button, and content that scrolls inside it. Escape or tapping outside closes it.
 * As a `dialog` it stays a sheet on phones but sits centred, at reading width,
 * on wider screens, with an optional micro label over the title.
 */
export function BottomSheet({
  title,
  eyebrow,
  dialog = false,
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  dialog?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const { overflow, paddingRight } = document.body.style;
    // Hiding the scrollbar widens the page; padding by its width keeps everything behind the sheet still.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className={`no-print fixed inset-0 z-40 flex flex-col justify-end ${
        dialog ? "md:items-center md:justify-center md:p-8" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92vh] flex-col border-t border-line-strong bg-ground-deep ${
          dialog ? "md:max-h-[80vh] md:w-full md:max-w-[560px] md:border" : ""
        }`}
      >
        <div
          className={`flex items-center gap-3 border-b border-line px-4 py-3 ${
            dialog ? "bg-faction" : "bg-panel-strong"
          }`}
        >
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="micro text-ink/80">
                {"// "}
                {eyebrow}
              </p>
            ) : null}
            <h2 className="truncate text-[15px] font-extrabold uppercase tracking-[0.04em]">
              {title}
            </h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="btn min-h-9 px-3 text-[11px]"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
