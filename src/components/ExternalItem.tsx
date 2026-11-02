"use client";

import { DetailSkeleton } from "./Skeleton";

import { PeopleLinks } from "./PeopleLinks";
import { BorrowOnline, HeroBackdrop, Row } from "./DetailParts";

import { useRouter, useSearchParams } from "next/navigation";
import { goBack } from "./BackButton";
import { modeByKind } from "@/lib/modes";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { Title } from "@/lib/types";
import {
  formatRuntime,
  formatSeries,
  isEItem,
  libraryUrl,
  posterUrl,
  tidySummary,
} from "@/lib/format";
import { Poster } from "./Poster";
import { LiveAvailability } from "./LiveAvailability";

type State =
  | { status: "loading" }
  | { status: "ok"; t: Title }
  | { status: "error"; message: string; expired: boolean };

/** Live-loaded detail for a full-catalogue result. Mirrors TitleDetail without catalogue-only bits. */
export function ExternalItem({
  headingLevel = "h1",
}: {
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const params = useSearchParams();
  const irn = params.get("irn") ?? "";
  const set = params.get("set") ?? "";
  const pos = params.get("pos") ?? "";
  // Passed through so the server can re-run the search if the result set has expired.
  const kind = params.get("kind") ?? "";
  const q = params.get("q") ?? "";
  const audience =
    params.get("audience") === "children" ? "&audience=children" : "";
  const router = useRouter();
  const mode =
    kind === "book" || kind === "audiobook" ? modeByKind(kind) : null;
  const key = `${irn}:${set}:${pos}`;
  const [state, setState] = useState<{ key: string; s: State } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/library/record?${new URLSearchParams({ irn, set, pos, ...(kind && { kind }), ...(q && { q }) })}${audience}`,
      {
        signal: ctrl.signal,
      },
    )
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok)
          setState({
            key,
            s: {
              status: "error",
              message: body.error ?? "Couldn't load this one.",
              expired: body.code === "expired",
            },
          });
        // A 200 that isn't a record (captive portal, truncated body) is an error, not a title.
        else if (
          typeof body?.title !== "string" ||
          !Array.isArray(body?.genres)
        )
          setState({
            key,
            s: {
              status: "error",
              message: "Couldn't load this one.",
              expired: false,
            },
          });
        else setState({ key, s: { status: "ok", t: body as Title } });
      })
      .catch(() => {
        if (!ctrl.signal.aborted)
          setState({
            key,
            s: {
              status: "error",
              message: "Couldn't reach the library just now.",
              expired: false,
            },
          });
      });
    return () => ctrl.abort();
  }, [irn, set, pos, key, kind, q, audience]);

  const s = state?.key === key ? state.s : { status: "loading" as const };

  if (s.status === "loading")
    return <DetailSkeleton label="Fetching this from the library catalogue" />;
  if (s.status === "error")
    return (
      <div className="space-y-3 p-8">
        <p className="font-display text-2xl">{s.message}</p>
        <button
          type="button"
          onClick={() => goBack(router, mode?.home ?? "/")}
          className="text-sea underline"
        >
          {s.expired ? "Back to search" : "Go back"}
        </button>
      </div>
    );

  const t = s.t;
  const record = libraryUrl(t);
  const art = posterUrl(t);
  return (
    <article className="overflow-hidden bg-card sm:rounded-xl">
      <div className="relative overflow-hidden bg-paper-2">
        <HeroBackdrop art={art} />
        <div className="relative flex flex-col gap-6 p-5 pt-10 sm:flex-row sm:items-end sm:p-8 sm:pt-12">
          <div className="w-36 shrink-0 shadow-xl sm:w-48">
            <Poster src={art} title={t.title} year={t.year} eager />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
              {t.format} · from the full catalogue
            </p>
            <Heading className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
              {t.title}
            </Heading>
            {(t.authors?.length ?? 0) > 0 && (
              <p className="text-muted">
                by <PeopleLinks names={t.authors!.slice(0, 3)} kind={t.kind} />
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {t.year && <span>{t.year}</span>}
              {formatRuntime(t.runtimeMins) && (
                <span>· {formatRuntime(t.runtimeMins)}</span>
              )}
              {t.pages ? <span>· {t.pages} pages</span> : null}
              {t.series && <span>· {formatSeries(t.series)}</span>}
            </div>
            {record && (
              <a
                href={record}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full bg-sea px-5 py-2.5 font-semibold text-on-sea transition hover:bg-sea-dark"
              >
                {isEItem(t) ? "Borrow online" : "Reserve at the library"}{" "}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
        {/* First in the DOM so phones (one column) read and tab to it before the synopsis. */}
        <aside className="lg:col-start-2 lg:row-start-1">
          {isEItem(t) ? (
            <BorrowOnline />
          ) : t.holdingsUnknown ? (
            <p className="rounded-lg border border-line p-4 text-sm text-muted">
              Couldn&apos;t check the shelves just now. The library&apos;s own
              page will show where copies are.
            </p>
          ) : (
            <LiveAvailability
              irn={t.irn}
              initial={t.holdings}
              snapshot={{ available: t.available, copies: t.copies }}
              preloaded={{
                irn: t.irn,
                fetchedAt: t.firstSeen,
                holdings: t.holdings,
                copies: t.copies,
                available: t.available,
              }}
            />
          )}
        </aside>
        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
          {t.summary ? (
            <p className="leading-relaxed">{tidySummary(t.summary)}</p>
          ) : (
            <p className="text-muted">No description from the library.</p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {t.narrators && t.narrators.length > 0 && (
              <Row label="Read by">
                <PeopleLinks names={t.narrators} kind={t.kind} />
              </Row>
            )}
            {t.genres.length > 0 && (
              <Row label="Genres">{t.genres.join(", ")}</Row>
            )}
            {t.publisher && <Row label="Publisher">{t.publisher}</Row>}
            {t.isbn && <Row label="ISBN">{t.isbn}</Row>}
          </dl>
        </div>
      </div>
    </article>
  );
}
