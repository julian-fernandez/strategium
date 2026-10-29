/** Faint rings and ticks behind the content, the way Destiny sets its sigils behind menus. */
export function Ornament() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg
      className="no-print pointer-events-none fixed inset-0 h-full w-full"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" stroke="white" strokeOpacity="0.055">
        <circle cx="1120" cy="470" r="250" />
        <circle cx="1120" cy="470" r="330" strokeDasharray="2 10" />
        <circle cx="1120" cy="470" r="420" />
        <circle cx="1120" cy="470" r="560" strokeOpacity="0.035" />
        {ticks.map((angle) => {
          const long = angle % 30 === 0;
          const rad = (angle * Math.PI) / 180;
          const r1 = 420;
          const r2 = long ? 448 : 432;
          return (
            <line
              key={angle}
              x1={1120 + r1 * Math.cos(rad)}
              y1={470 + r1 * Math.sin(rad)}
              x2={1120 + r2 * Math.cos(rad)}
              y2={470 + r2 * Math.sin(rad)}
            />
          );
        })}
        <path d="M1120 140v60M1120 740v60M790 470h60M1390 470h60" strokeOpacity="0.09" />
        <path d="M0 132H1600" strokeOpacity="0.04" />
      </g>
    </svg>
  );
}
