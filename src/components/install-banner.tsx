"use client";

import { useEffect, useState } from "react";
import { useIsStandalone } from "@/lib/use-standalone";

const DISMISSED_KEY = "__pwa_install_banner_dismissed";

/**
 * Install-instruction banner shown whenever the app is not running in
 * standalone display mode. Dismissal persists in localStorage until
 * standalone mode is independently detected, at which point the flag is
 * cleared (so the banner can show again if the user somehow reverts to
 * browser-tab mode).
 */
export function InstallBanner() {
  const isStandalone = useIsStandalone();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  useEffect(() => {
    if (isStandalone) {
      window.localStorage.removeItem(DISMISSED_KEY);
    }
  }, [isStandalone]);

  if (isStandalone || dismissed) {
    return null;
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="w-full max-w-sm rounded border-l-4 border-zinc-900 bg-zinc-100 p-3 dark:bg-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Установить приложение</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Поделиться → На экран «Домой»
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Скрыть"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
