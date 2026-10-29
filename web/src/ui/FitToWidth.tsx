import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * Shrinks a fixed-size, millimetre-sized card to fit the available width, so
 * print-sized cards work on phones and tablets. It scales down only, never up
 * past `max`, and is switched off when printing (see `.fit-wrap` in styles.css).
 */
export function FitToWidth({ children, max = 1 }: { children: ReactNode; max?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0, width: 0 });

  useLayoutEffect(() => {
    const outerElement = outer.current;
    const innerElement = inner.current;
    if (!outerElement || !innerElement) return;

    const measure = () => {
      const natural = { width: innerElement.offsetWidth, height: innerElement.offsetHeight };
      const available = outerElement.clientWidth;
      const scale = natural.width ? Math.min(max, available / natural.width) : 1;
      setBox({ scale, height: natural.height * scale, width: natural.width * scale });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outerElement);
    observer.observe(innerElement);
    return () => observer.disconnect();
  }, [max]);

  return (
    <div ref={outer} className="fit-wrap w-full">
      <div className="relative mx-auto" style={{ height: box.height, width: box.width }}>
        <div
          ref={inner}
          className="fit-inner absolute left-0 top-0 w-max origin-top-left"
          style={{ transform: `scale(${box.scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
