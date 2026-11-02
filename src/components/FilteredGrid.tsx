"use client";

import type { CardTitle } from "@/lib/card";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import { TitleCard } from "./TitleCard";

/** Small grid (e.g. "More like this") that respects the library/on-shelf preferences. */
export function FilteredGrid({ items, max = 12 }: { items: CardTitle[]; max?: number }) {
  const prefs = usePrefs();
  const visible = items.filter((t) => matchesPrefs(t, prefs)).slice(0, max);
  if (visible.length === 0) return <p className="text-sm text-muted">Nothing similar matches your library settings.</p>;
  return (
    <div data-pref-filtered className="card-grid gap-x-3 gap-y-6 sm:gap-x-4">
      {visible.map((s) => (
        <TitleCard key={s.irn} t={s} />
      ))}
    </div>
  );
}
