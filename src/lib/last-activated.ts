"use client";

// The link that opens a route dialog loses focus during navigation (the page re-renders it),
// so remember the last link/button the user clicked or pressed a key on. Imported from the
// root layout (via Hydrated) so it's listening before any dialog code has loaded.
let lastActivated: HTMLElement | null = null;

if (typeof document !== "undefined") {
  const record = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.("a[href], button");
    if (el instanceof HTMLElement) lastActivated = el;
  };
  document.addEventListener("click", record, true);
  document.addEventListener("keydown", record, true);
}

export const getLastActivated = () => lastActivated;
