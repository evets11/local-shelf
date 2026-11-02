"use client";

import { useSyncExternalStore } from "react";

// Saved titles live in localStorage only. No accounts, nothing leaves the browser.
const KEY = "shelflife:my-list";
const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cache: { raw: string | null; value: string[] } = {
  raw: null,
  value: EMPTY,
};

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  // useSyncExternalStore needs a stable reference between unchanged reads.
  if (raw !== cache.raw) {
    let value: string[] = EMPTY;
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed))
        value = parsed.filter((x) => typeof x === "string");
    } catch {}
    cache = { raw, value };
  }
  return cache.value;
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMyList() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    list,
    has: (irn: string) => list.includes(irn),
    toggle: (irn: string) => {
      const current = read();
      write(
        current.includes(irn)
          ? current.filter((x) => x !== irn)
          : [irn, ...current],
      );
    },
  };
}
