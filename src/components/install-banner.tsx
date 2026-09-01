"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useIsStandalone } from "@/lib/use-standalone";

const DISMISSED_KEY = "__pwa_install_banner_dismissed";
// Native "storage" events only fire in OTHER tabs, never the tab that made
// the write — this synthetic event lets same-tab writers self-notify.
const DISMISSED_CHANGED_EVENT = "install-banner-dismissed-changed";

function getDismissedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function getDismissedServerSnapshot(): boolean {
  return false;
}

function subscribeToDismissed(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DISMISSED_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DISMISSED_CHANGED_EVENT, onStoreChange);
  };
}

function setDismissedFlag(value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } else {
      window.localStorage.removeItem(DISMISSED_KEY);
    }
  } catch {
    // storage unavailable — dismissal simply won't persist across reloads
  }
  window.dispatchEvent(new Event(DISMISSED_CHANGED_EVENT));
}

/**
 * Install-instruction banner shown whenever the app is not running in
 * standalone display mode. Dismissal persists in localStorage until
 * standalone mode is independently detected, at which point the flag is
 * cleared (so the banner can show again if the user somehow reverts to
 * browser-tab mode).
 */
export function InstallBanner() {
  const isStandalone = useIsStandalone();
  const dismissed = useSyncExternalStore(
    subscribeToDismissed,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );

  useEffect(() => {
    if (isStandalone) {
      setDismissedFlag(false);
    }
  }, [isStandalone]);

  if (isStandalone || dismissed) {
    return null;
  }

  function handleDismiss() {
    setDismissedFlag(true);
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
