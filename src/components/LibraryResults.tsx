"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import type { CardTitle } from "@/lib/card";
import type { Kind } from "@/lib/types";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import {
  DECADE_LABELS,
  matchesFormatAndDecade,
  type Filters,
} from "@/lib/filters";
import { TitleCard } from "./TitleCard";
import { CardGridSkeleton } from "./Skeleton";

type Hit = CardTitle & {
  pos: number;
  summary: string | null;
  isEItem: boolean;
};
type Result =
  | { key: string; status: "ok"; setId: string; total: number; hits: Hit[] }
  | { key: string; status: "error"; message: string };

const DEBOUNCE_MS = 600;

const plural = (n: number, one: string, many = `${one}es`) =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

const joinOr = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`;

/**
 * Books/audiobooks only index the newest titles, so a search also asks the library's full
 * catalogue (relayed live by /api/library/search) and lists anything we don't already show.
 *
 * Search hits only carry year, format and overall copy counts, so on-shelf, format and decade
 * filter here; children's re-runs the search for junior titles. Library, genre, language and
 * "grown-ups" can't be checked without a request per hit, so the section says it skipped them.
 */
export function LibraryResults({
  kind,
  q,
  exclude,
  filters,
}: {
  kind: Exclude<Kind, "film">;
  q: string;
  exclude: Set<string>;
  filters: Filters;
}) {
  const prefs = usePrefs();
  const query = q.trim();
  // Live hits carry no audience, so children's titles need the library's own junior filter.
  const kids = prefs.profile === "kids";
  const children = kids || filters.audience === "children";
  const key = `${kind}:${children ? "kids" : "all"}:${query.toLowerCase()}`;
  const [result, setResult] = useState<Result | null>(null);
  const [showAll, setShowAll] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 3) return;
    const ctrl = new AbortController();
    // Only ask once typing pauses, so we relay searches, not keystrokes.
    const timer = setTimeout(() => {
      fetch(
        `/api/library/search?kind=${kind}&q=${encodeURIComponent(query)}${children ? "&audience=children" : ""}`,
        {
          signal: ctrl.signal,
        },
      )
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok)
            throw new Error(
              body.error ?? "The library catalogue didn't answer.",
            );
          setResult({ key, status: "ok", ...body });
        })
        .catch((e: Error) => {
          if (!ctrl.signal.aborted)
            setResult({ key, status: "error", message: e.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [kind, query, key, children]);

  if (query.length < 3) return null;
  const current = result?.key === key ? result : null;
  // Saved profile/format prefs always apply; only this view's filters can be shown anyway.
  const fresh =
    current?.status === "ok"
      ? current.hits.filter(
          (h) =>
            !exclude.has(h.irn) &&
            matchesPrefs(h, { ...prefs, branch: "", onShelfOnly: false }),
        )
      : [];
  const matching = fresh.filter(
    (h) =>
      // Branch is unknown until a record is opened, so on-shelf means "somewhere".
      (!filters.available || h.isEItem || h.available > 0) &&
      matchesFormatAndDecade(h, filters),
  );
  const hidden = fresh.length - matching.length;
  // Any filter change collapses "show anyway" again.
  const viewKey = `${key}|${filters.available}|${filters.format}|${filters.decade}`;
  const expanded = showAll === viewKey && hidden > 0;
  const shown = expanded ? fresh : matching;

  const applied = [
    filters.available &&
      (filters.branch ? "On the shelf at any library" : "On the shelf"),
    filters.format,
    filters.decade && (DECADE_LABELS[filters.decade] ?? filters.decade),
    // Kids has its own banner above.
    !kids && filters.audience === "children" && "Children's",
  ].filter((x): x is string => Boolean(x));
  const skipped = [
    filters.branch,
    filters.genre,
    filters.language,
    !kids && filters.audience === "adult" && "grown-ups' titles",
  ].filter((x): x is string => Boolean(x));

  const noun = kind === "book" ? "book" : "audiobook";

  return (
    <section
      id="library-results"
      aria-labelledby="library-results-heading"
      className="mt-12 scroll-mt-20 border-t border-line pt-8"
    >
      <h2
        id="library-results-heading"
        className="font-display text-2xl font-semibold"
      >
        From the whole library catalogue
      </h2>
      <p className="mt-1 text-sm text-muted">
        Every {noun} in Brighton &amp; Hove Libraries, searched live.
      </p>

      {(applied.length > 0 || skipped.length > 0) && (
        <div className="mt-4 space-y-2 rounded-lg border border-line bg-card px-4 py-3 text-sm">
          {applied.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted">Filtered to</span>
              {applied.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-sea/10 px-2.5 py-0.5 font-medium text-sea"
                >
                  {a}
                </span>
              ))}
            </p>
          )}
          {skipped.length > 0 && (
            <p className="flex gap-2 text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Not narrowed to{" "}
                <strong className="font-semibold text-ink">
                  {joinOr(skipped)}
                </strong>
                , as the library&apos;s search results don&apos;t include{" "}
                {skipped.length === 1 ? "that" : "those"}.
                {filters.branch &&
                  " Open a title to see which libraries have it on the shelf."}
              </span>
            </p>
          )}
        </div>
      )}

      <p className="mb-5 mt-4 text-sm text-muted" aria-live="polite">
        {!current ? (
          `Searching every ${noun}…`
        ) : current.status === "error" ? (
          current.message
        ) : shown.length === 0 ? (
          hidden > 0 ? (
            `Found ${plural(hidden, "more match")}, but none fit your filters.`
          ) : (
            "Nothing else matched in the full catalogue."
          )
        ) : (
          <>
            {plural(shown.length, "more match")}
            {current.total > current.hits.length
              ? ` from the library's top ${current.hits.length} of ${current.total.toLocaleString("en-GB")}. Add more words to narrow it down.`
              : "."}
          </>
        )}
      </p>

      {!current && (
        <CardGridSkeleton count={6} label="Searching the library catalogue" />
      )}
      {shown.length > 0 && current?.status === "ok" && (
        <div className="card-grid gap-x-3 gap-y-7 sm:gap-x-5">
          {shown.map((h) => (
            <TitleCard
              key={h.irn}
              t={h}
              href={`/item?irn=${h.irn}&set=${current.setId}&pos=${h.pos}&kind=${kind}&q=${encodeURIComponent(query)}${children ? "&audience=children" : ""}`}
            />
          ))}
        </div>
      )}
      {hidden > 0 && (
        <div className={shown.length > 0 ? "mt-8 text-center" : ""}>
          <button
            type="button"
            onClick={() => setShowAll(expanded ? null : viewKey)}
            className="rounded-full border border-line bg-card px-5 py-2 text-sm font-semibold hover:border-sea hover:text-sea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/30"
          >
            {expanded
              ? "Hide ones that don't fit your filters"
              : matching.length === 0
                ? hidden === 1
                  ? "Show it anyway"
                  : "Show them anyway"
                : `Show ${plural(hidden, "more match")} that ${hidden === 1 ? "doesn't" : "don't"} fit`}
          </button>
        </div>
      )}
    </section>
  );
}
