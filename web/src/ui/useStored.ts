import { useCallback, useState } from "react";

/**
 * State remembered in localStorage, so a reload mid-game lands where you were.
 * An object is read over its fallback, so a field added later gets its
 * default. Storage can be unavailable; the state then just isn't remembered.
 */
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Not remembered, but still set.
      }
    },
    [key],
  );
  return [value, set];
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const saved = JSON.parse(raw) as T;
    const isObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
    return isObject(fallback) && isObject(saved) ? { ...fallback, ...saved } : saved;
  } catch {
    return fallback;
  }
}
