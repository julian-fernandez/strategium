import { useEffect } from "react";

/**
 * Keeps the screen from dimming while `active`, taking the lock again when the
 * page comes back into view (the browser drops it when you switch away). Phones
 * only allow it on a secure page, so over plain http on the network it does nothing.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let stopped = false;
    const take = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (stopped) await lock.release();
      } catch {
        // Refused: not a secure page, or the battery is low.
      }
    };
    void take();
    document.addEventListener("visibilitychange", take);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, [active]);
}
