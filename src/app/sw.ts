/// <reference lib="webworker" />
/// <reference no-default-lib="true" />

import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// `self.__SW_MANIFEST` below is the literal injection point @serwist/next's
// build plugin scans for and replaces — omitting it defeats manifest
// injection entirely. next.config.ts's `exclude: [/.*/]` keeps the injected
// manifest empty (see T-04-04 in 04-02-PLAN.md's threat model).
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addEventListeners();
