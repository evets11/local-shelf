"use client";

import { useEffect, useState } from "react";
import type { CardTitle } from "@/lib/card";
import type { Kind } from "@/lib/types";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
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

/**
 * Books/audiobooks only index the newest titles, so a search also asks the library's full
 * catalogue (relayed live by /api/library/search) and lists anything we don't already show.
 */
export function LibraryResults({
  kind,
  q,
  exclude,
}: {
  kind: Exclude<Kind, "film">;
  q: string;
  exclude: Set<string>;
}) {
  const prefs = usePrefs();
  const query = q.trim();
  // Kids asks the catalogue for children's titles only (live hits carry no audience otherwise).
  const kids = prefs.profile === "kids";
  const key = `${kind}:${kids ? "kids" : "all"}:${query.toLowerCase()}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (query.length < 3) return;
    const ctrl = new AbortController();
    // Only ask once typing pauses, so we relay searches, not keystrokes.
    const timer = setTimeout(() => {
      fetch(
        `/api/library/search?kind=${kind}&q=${encodeURIComponent(query)}${kids ? "&audience=children" : ""}`,
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
  }, [kind, query, key, kids]);

  if (query.length < 3) return null;
  const current = result?.key === key ? result : null;
  const hits =
    current?.status === "ok"
      ? current.hits.filter(
          (h) =>
            !exclude.has(h.irn) &&
            matchesPrefs(h, { ...prefs, branch: "", onShelfOnly: false }),
        )
      : [];

  return (
    <section
      aria-labelledby="library-results"
      className="mt-12 border-t border-line pt-8"
    >
      <h2 id="library-results" className="font-display text-2xl font-semibold">
        From the whole library catalogue
      </h2>
      <p className="mb-5 text-sm text-muted" aria-live="polite">
        {!current ? (
          `Searching every ${kind === "book" ? "book" : "audiobook"} in Brighton & Hove libraries…`
        ) : current.status === "error" ? (
          current.message
        ) : hits.length === 0 ? (
          "Nothing else matched in the full catalogue."
        ) : (
          <>
            {current.total > current.hits.length
              ? `Top ${hits.length} of ${current.total.toLocaleString("en-GB")} matches. Try more words to narrow it down.`
              : `${hits.length} more ${hits.length === 1 ? "match" : "matches"}.`}
            {prefs.branch || prefs.onShelfOnly
              ? " Shelf details load when you open one."
              : ""}
          </>
        )}
      </p>
      {!current && (
        <CardGridSkeleton count={6} label="Searching the library catalogue" />
      )}
      {hits.length > 0 && current?.status === "ok" && (
        <div className="card-grid gap-x-3 gap-y-7 sm:gap-x-5">
          {hits.map((h) => (
            <TitleCard
              key={h.irn}
              t={h}
              href={`/item?irn=${h.irn}&set=${current.setId}&pos=${h.pos}&kind=${kind}&q=${encodeURIComponent(query)}${kids ? "&audience=children" : ""}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
