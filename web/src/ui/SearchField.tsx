import { type KeyboardEvent, type RefObject, useEffect, useRef } from "react";

/**
 * A search box. Its text is 16px so phones don't zoom in on it; it clears
 * with its own button or Escape, and "/" jumps to it from anywhere on a keyboard.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  inputRef,
  onFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onFocus?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const own = useRef<HTMLInputElement>(null);
  const input = inputRef ?? own;

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input]);

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onChange("");
            event.currentTarget.blur();
          }
          onKeyDown?.(event);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-11 w-full bg-ground-deep pl-9 pr-11 text-[16px] text-ink placeholder:text-ink-faint hairline focus:border-line-strong focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear the search"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[20px] leading-none text-ink-dim hover:text-ink"
        >
          ×
        </button>
      ) : (
        <span className="key-hint absolute right-3 top-1/2 -translate-y-1/2">/</span>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </svg>
  );
}
