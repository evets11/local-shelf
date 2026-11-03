"use client";

import type { CardTitle } from "@/lib/card";
import type { PrizePick } from "@/lib/prizes/shelves";
import { matchesPrefs, usePrefs, type Prefs } from "@/lib/prefs";
import { ShelfRow } from "./Shelf";

/** The cards a prize row shows: each book's first format that passes `prefs`, once per book. */
export function prizeRowItems(
  picks: PrizePick[],
  prefs: Prefs,
  max = 30,
): { t: CardTitle; label: string }[] {
  // A book on two lists (e.g. Booker and Waterstones) shows once, with its first (best) label.
  const seen = new Set<string>();
  return picks
    .flatMap((p) => {
      const t = p.cards.find((c) => matchesPrefs(c, prefs));
      if (!t || seen.has(t.irn)) return [];
      seen.add(t.irn);
      return [{ t, label: p.label }];
    })
    .slice(0, max);
}

/**
 * A row of prize books. Each book shows the first of its formats (print, eBook, audio) that
 * passes the viewer's preferences, so "On the shelf" or an eBook-only setting still finds it.
 */
export function PrizeShelf({
  title,
  href,
  picks,
  id,
  description,
  max = 30,
}: {
  title: string;
  href?: string;
  picks: PrizePick[];
  id?: string;
  description?: React.ReactNode;
  max?: number;
}) {
  const items = prizeRowItems(picks, usePrefs(), max);
  return (
    <ShelfRow
      title={title}
      href={href}
      items={items}
      id={id}
      description={description}
    />
  );
}
