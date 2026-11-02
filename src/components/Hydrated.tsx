"use client";

import { useEffect } from "react";
// Side-effect import: start tracking what opens dialogs as early as possible.
import "@/lib/last-activated";
// Side-effect import: install-prompt capture, service worker, external links in the app.
import "@/lib/pwa";

/** Marks <html data-hydrated> once React is running, so pref-filtered regions can show. */
export function Hydrated() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return null;
}
