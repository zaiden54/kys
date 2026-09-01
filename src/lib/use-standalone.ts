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
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    function handleChange() {
      setIsStandalone(detectStandalone());
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isStandalone;
}
