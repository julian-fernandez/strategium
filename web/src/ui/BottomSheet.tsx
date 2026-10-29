import { type ReactNode, useEffect, useRef } from "react";

/**
 * A full-height sheet over the page, for phones: a title bar with a close
 * button, and content that scrolls inside it. Escape or tapping outside closes it.
 */
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-40 flex flex-col justify-end">
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
        className="relative flex max-h-[92vh] flex-col border-t border-line-strong bg-ground-deep"
      >
        <div className="flex items-center gap-3 border-b border-line bg-panel-strong px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-extrabold uppercase tracking-[0.04em]">
            {title}
          </h2>
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
