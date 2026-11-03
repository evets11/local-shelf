"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { PrizeSection } from "@/lib/prizes/shelves";
import { DEFAULT_PREFS, usePrefs } from "@/lib/prefs";
import { prizesHref } from "@/lib/modes";
import { usePrizesKind, type PrizesKind } from "@/lib/prizes-kind";
import { PrizeShelf, prizeRowItems } from "./PrizeShelf";

/** PrizeSections for the collection in the URL (or the last one used). Needs <Suspense>. */
export function PrizeSectionsForUrl({
  sections,
}: {
  sections: PrizeSection[];
}) {
  const kind = usePrizesKind();
  // The static HTML shows books, so on a full load of /prizes?for=audiobooks#anchor the browser
  // scrolled within the books layout. Scroll again once this collection's rows are in.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current) return;
    scrolled.current = true;
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return <PrizeSections sections={sections} kind={kind} />;
}

/**
 * A Books/Audiobooks switch, jump links and a row per prize and year, showing only `kind`. Rows
 * that the viewer's preferences empty (e.g. adult prizes under Kids) disappear, and so do their
 * jump links.
 */
export function PrizeSections({
  sections,
  kind,
}: {
  sections: PrizeSection[];
  kind: PrizesKind;
}) {
  const prefs = usePrefs();
  const shown = sections
    .map((s) => {
      const picks = s.picks
        .map((p) => ({ ...p, cards: p.cards.filter((c) => c.kind === kind) }))
        .filter((p) => p.cards.length > 0);
      // Counted the way the row picks its cards (one per book), so the text matches the covers.
      const held = prizeRowItems(picks, DEFAULT_PREFS, Infinity).length;
      const matching = prizeRowItems(picks, prefs, Infinity).length;
      return { ...s, picks, held, matching };
    })
    .filter((s) => s.matching > 0);
  const noun = kind === "audiobook" ? "audiobooks" : "books";

  return (
    <>
      <nav aria-label="Collection" className="mb-5 flex gap-1.5 px-4 sm:px-8">
        {(["book", "audiobook"] as const).map((k) => (
          <Link
            key={k}
            href={prizesHref(k)}
            replace
            scroll={false}
            aria-current={k === kind ? "page" : undefined}
            className="rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-ink hover:border-sea aria-[current=page]:border-sea aria-[current=page]:bg-sea aria-[current=page]:text-on-sea"
          >
            {k === "audiobook" ? "Audiobooks" : "Books"}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <div
          data-pref-filtered
          className="mx-4 rounded-xl border border-dashed border-line bg-card p-8 text-center sm:mx-8"
        >
          <p className="font-display text-2xl">
            Nothing here matches your settings.
          </p>
          <p className="mt-1 text-sm text-muted">
            {prefs.profile === "kids"
              ? `The children's prize ${noun} aren't on the shelf right now. Try turning off “On the shelf”.`
              : "Try another library, another format, or turn off “On the shelf”."}
          </p>
        </div>
      ) : (
        <>
          <nav
            aria-label="Prizes"
            data-pref-filtered
            className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:px-8"
          >
            {shown.map((s) => (
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
            {shown.map((s) => (
              <PrizeShelf
                key={s.anchor}
                id={s.anchor}
                title={`${s.prize.name} ${s.year}`}
                picks={s.picks}
                description={
                  <>
                    The library has {s.held} of the {s.listed}{" "}
                    {s.listed === 1
                      ? "book on this list"
                      : "books on these lists"}
                    {kind === "audiobook" ? " as audiobooks" : ""}.
                    {s.matching < s.held &&
                      ` ${s.matching} ${s.matching === 1 ? "matches" : "match"} your settings.`}{" "}
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
      )}
    </>
  );
}
