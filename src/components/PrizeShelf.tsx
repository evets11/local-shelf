"use client";

import type { PrizePick } from "@/lib/prizes/shelves";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import { ShelfRow } from "./Shelf";

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
  const prefs = usePrefs();
  // A book on two lists (e.g. Booker and Waterstones) shows once, with its first (best) label.
  const seen = new Set<string>();
  const items = picks
    .flatMap((p) => {
      const t = p.cards.find((c) => matchesPrefs(c, prefs));
      if (!t || seen.has(t.irn)) return [];
      seen.add(t.irn);
      return [{ t, label: p.label }];
    })
    .slice(0, max);
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
