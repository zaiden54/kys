"use client";

import { useSyncExternalStore } from "react";

// navigator.standalone is an iOS-Safari-only, non-standard property absent
// from TypeScript's default DOM lib types.
declare global {
  interface Navigator {
    readonly standalone?: boolean;
  }
}

function detectStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

function getStandaloneServerSnapshot(): boolean {
  return false;
}

function subscribeToStandalone(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

/**
 * Returns true when the app is running in standalone display mode (installed
 * to the iOS home screen / launched from it), false otherwise. Re-evaluates
 * on matchMedia "change" events.
 *
 * Uses useSyncExternalStore (not useState+useEffect) so the server snapshot
 * (always `false`) and the client's first-paint snapshot never mismatch
 * without needing a post-mount setState — which previously required an
 * effect-driven `setState` that re-triggered ESLint's
 * `react-hooks/set-state-in-effect` rule.
 */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    subscribeToStandalone,
    detectStandalone,
    getStandaloneServerSnapshot,
  );
}
