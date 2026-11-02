"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { PrizeSection } from "@/lib/prizes/shelves";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import { PrizeShelf } from "./PrizeShelf";

/**
 * Jump links and a row per prize and year. Rows that the viewer's preferences empty (e.g. adult
 * prizes under Kids) disappear, and so do their jump links.
 */
export function PrizeSections({ sections }: { sections: PrizeSection[] }) {
  const prefs = usePrefs();
  const visible = sections.filter((s) =>
    s.picks.some((p) => p.cards.some((c) => matchesPrefs(c, prefs))),
  );

  if (visible.length === 0)
    return (
      <div
        data-pref-filtered
        className="mx-4 rounded-xl border border-dashed border-line bg-card p-8 text-center sm:mx-8"
      >
        <p className="font-display text-2xl">
          Nothing here matches your settings.
        </p>
        <p className="mt-1 text-sm text-muted">
          {prefs.profile === "kids"
            ? "The children's prize books aren't on the shelf right now. Try turning off “On the shelf”."
            : "Try another library, or turn off “On the shelf”."}
        </p>
      </div>
    );

  return (
    <>
      <nav
        aria-label="Prizes"
        data-pref-filtered
        className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:px-8"
      >
        {visible.map((s) => (
          <Link
            key={s.anchor}
            href={`#${s.anchor}`}
            className="flex h-8 shrink-0 items-center rounded-full border border-line px-3 text-[13px] font-medium text-ink hover:border-sea hover:text-sea"
          >
            {s.prize.name} {s.year}
          </Link>
        ))}
      </nav>
      <div className="mt-8 space-y-12">
        {visible.map((s) => (
          <PrizeShelf
            key={s.anchor}
            id={s.anchor}
            title={`${s.prize.name} ${s.year}`}
            picks={s.picks}
            description={
              <>
                The library has {s.picks.length} of the {s.listed} books on{" "}
                {s.listed === 1 ? "this list" : "these lists"}.{" "}
                <a
                  href={s.prize.site}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-0.5 text-sea underline-offset-2 hover:underline"
                >
                  About the prize
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </>
            }
          />
        ))}
      </div>
    </>
  );
}
