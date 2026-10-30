import { useContext } from "react";
import { FactionIconContext } from "./factionIcon";

/**
 * Our own line icons and emblems. The one piece of Games Workshop artwork is
 * the faction emblem, fetched at run time into the data cache, never committed.
 */

export function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
    </svg>
  );
}

export function BladesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 4l10 10M20 4L10 14M7 17l-3 3M17 17l3 3M6 15l3 3M18 15l-3 3" />
    </svg>
  );
}

/** A plain heraldic diamond with a cross: the faction emblem stand-in and render placeholder. */
/**
 * The faction's emblem in the current text colour: the faction's own when the
 * icon set has one, drawn as a mask so it takes any colour, else the app's.
 */
export function Emblem({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  const icon = useContext(FactionIconContext);
  if (icon) {
    const mask = `url("${icon}") center / contain no-repeat`;
    return (
      <span
        className={`inline-block bg-current ${className ?? ""}`}
        style={{ mask, WebkitMask: mask }}
        aria-hidden
      />
    );
  }
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
    >
      <path d="M24 3 45 24 24 45 3 24Z" />
      <path d="M24 10 38 24 24 38 10 24Z" />
      <path d="M24 14v20M17 21h14" />
      <circle cx="24" cy="21" r="2.5" />
    </svg>
  );
}

export function ShieldShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 22" className={className} aria-hidden>
      <path d="M10 1 19 4v7c0 5-4 8.5-9 10C5 19.5 1 16 1 11V4Z" fill="currentColor" />
    </svg>
  );
}

/** Two arcs turning about each other: turn a card over. */
export function FlipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden
    >
      <path d="M4.5 10.5a7.5 7.5 0 0 1 13.6-3.9" />
      <path d="M18.5 3v4h-4" />
      <path d="M19.5 13.5a7.5 7.5 0 0 1-13.6 3.9" />
      <path d="M5.5 21v-4h4" />
    </svg>
  );
}
