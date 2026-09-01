"use client";

import { useEffect, useState } from "react";

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

/**
 * Returns true when the app is running in standalone display mode (installed
 * to the iOS home screen / launched from it), false otherwise. Re-evaluates
 * on matchMedia "change" events.
 */
export function useIsStandalone(): boolean {
  // Initialized to a stable `false` (not detectStandalone()) so the server
  // render and the client's hydration render always match — `window` is
  // always undefined on the server, but on the client an actually-standalone
  // app would otherwise return `true` on that very first hydration pass,
  // causing a hydration mismatch. The real value is computed after mount.
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    function handleChange() {
      setIsStandalone(detectStandalone());
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isStandalone;
}
