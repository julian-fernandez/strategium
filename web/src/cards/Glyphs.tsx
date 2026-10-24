/** Our own line icons and emblems. No Games Workshop artwork. */

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
export function Emblem({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
}) {
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
