"use client";

import { useSyncExternalStore } from "react";
import type { Branch, Format, Title } from "./types";
import { DISPLAY_KEYS, PREFS_KEY, setThemeColor } from "./prefs-script";
import { isEItem } from "./format";

// Per-device preferences, kept in localStorage. Nothing leaves the browser.
export interface Prefs {
  /** Preferred library branch, or "" for any. */
  branch: string;
  /** Hide things with no copy on the shelf (at `branch` when set). */
  onShelfOnly: boolean;
  /** "kids" limits everything to children's titles, like a streaming kids profile. */
  profile: "everyone" | "kids";
  /** Audiobooks only: show both formats, just eAudiobooks, or just CDs. */
  audioFormat: "all" | "eaudiobook" | "cd";
  theme: "dark" | "light";
  cover: "big" | "standard" | "compact";
  textSize: "normal" | "large" | "xlarge";
  contrast: "normal" | "high";
  motion: "normal" | "reduce";
  font: "default" | "readable";
}

export const DEFAULT_PREFS: Prefs = {
  branch: "",
  onShelfOnly: false,
  profile: "everyone",
  audioFormat: "all",
  theme: "dark",
  cover: "standard",
  textSize: "normal",
  contrast: "normal",
  motion: "normal",
  font: "default",
};

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Prefs } = {
  raw: null,
  value: DEFAULT_PREFS,
};

function read(): Prefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFS_KEY);
  } catch {
    return DEFAULT_PREFS;
  }
  // useSyncExternalStore needs a stable reference between unchanged reads.
  if (raw !== cache.raw) {
    let value = DEFAULT_PREFS;
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object")
        value = { ...DEFAULT_PREFS, ...parsed };
      // Anything but "kids" is the everyone profile.
      if (value.profile !== "kids" && value.profile !== "everyone") value = { ...value, profile: "everyone" };
    } catch {}
    cache = { raw, value };
  }
  return cache.value;
}

function applyDisplay(p: Prefs) {
  const d = document.documentElement.dataset;
  for (const k of DISPLAY_KEYS) d[k] = p[k];
  setThemeColor(p.theme, p.contrast);
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...read(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {}
  applyDisplay(next);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PREFS_KEY) return;
    applyDisplay(read());
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
}

type Filterable = {
  available: number;
  availableAt: Branch[];
  branches: Branch[];
  format: Format;
  audience: Title["audience"];
};


/** Does a title pass the user's profile/library/on-shelf preferences? e-items are available everywhere. */
export function matchesPrefs(
  t: Filterable,
  p: Pick<Prefs, "branch" | "onShelfOnly" | "profile" | "audioFormat">,
): boolean {
  if (p.profile === "kids" && t.audience !== "children") return false;
  if (t.format === "Audiobook CD" && p.audioFormat === "eaudiobook") return false;
  if (t.format === "eAudiobook" && p.audioFormat === "cd") return false;
  if (isEItem(t)) return true;
  if (p.branch)
    return p.onShelfOnly
      ? t.availableAt.includes(p.branch)
      : t.branches.includes(p.branch);
  return p.onShelfOnly ? t.available > 0 : true;
}

