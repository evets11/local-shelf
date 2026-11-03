"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { modeBySlug } from "./modes";
import { LAST_MODE_KEY } from "./prefs-script";

export type PrizesKind = "book" | "audiobook";

function lastMode(): string | null {
  try {
    return localStorage.getItem(LAST_MODE_KEY);
  } catch {
    return null;
  }
}

// The last section only changes on other pages, so there's nothing to subscribe to.
const noSubscribe = () => () => {};

/**
 * Which collection the prizes page shows: `?for=books|audiobooks`, else the last section used,
 * else books. Reads the URL, so callers sit inside <Suspense>.
 */
export function usePrizesKind(): PrizesKind {
  const fromUrl = modeBySlug(useSearchParams().get("for") ?? "")?.kind;
  const last = useSyncExternalStore(noSubscribe, lastMode, () => null);
  const kind = fromUrl ?? modeBySlug(last ?? "")?.kind;
  return kind === "audiobook" ? "audiobook" : "book";
}
