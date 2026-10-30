import { createContext, useEffect, useState } from "react";
import { api } from "../client";

/**
 * The army's faction emblem, as a data URL every `Emblem` draws in its own
 * colour. Undefined while it loads, or when the icon set has none for the
 * faction, so the app's own emblem shows instead.
 */
export const FactionIconContext = createContext<string | undefined>(undefined);

export function useFactionIcon(faction: string | undefined): string | undefined {
  const [icon, setIcon] = useState<{ faction: string; url: string }>();
  useEffect(() => {
    if (!faction) return;
    let current = true;
    api.icon
      .$get({ query: { faction } })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body) => {
        if (!current) return;
        const svg = body && "svg" in body ? body.svg : undefined;
        setIcon(
          svg
            ? { faction, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
            : undefined,
        );
      })
      .catch(() => {
        if (current) setIcon(undefined);
      });
    return () => {
      current = false;
    };
  }, [faction]);
  return icon && icon.faction === faction ? icon.url : undefined;
}
