"use client";

import { useSyncExternalStore } from "react";

// Installability state, shared by the install sheet and the Settings button.
// Imported for side effects by Hydrated, so the listeners exist before the browser fires
// beforeinstallprompt (it fires once, early).

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** iPhone/iPad, including iPadOS reporting itself as a Mac. */
export const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") &&
      navigator.maxTouchPoints > 1));

/** Social apps' built-in browsers can't add to the home screen. */
export const isInAppBrowser = () =>
  typeof navigator !== "undefined" &&
  /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Twitter|TikTok|Snapchat|musical_ly|GSA\//.test(
    navigator.userAgent,
  );

if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own, better-timed prompt
    deferred = e as InstallPromptEvent;
    notify();
  });
  addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });

  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    // This module can load after the page's load event; don't wait for one that's gone.
    if (document.readyState === "complete") register();
    else addEventListener("load", register);
  }

  // A home-screen app has no address bar or back button, so other sites open outside it.
  document.addEventListener(
    "click",
    (e) => {
      if (!isStandalone() || e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      if (new URL(a.href, location.href).origin === location.origin) return;
      e.preventDefault();
      open(a.href, "_blank", "noopener");
    },
    true,
  );
}

export type InstallMode =
  | "installed" // running as the app, or just installed
  | "prompt" // Chromium: we hold the browser's install prompt
  | "ios" // iOS: Share > Add to Home Screen
  | "unsupported" // in-app browser, Firefox desktop etc.
  | "pending"; // server render: not known until the browser says

function mode(): InstallMode {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos() && !isInAppBrowser()) return "ios";
  return "unsupported";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, mode, () => "pending");
}

/** Shows the browser's install dialog. Resolves true if the user installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // a prompt can only be used once
  notify();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}
