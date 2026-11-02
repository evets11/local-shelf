import Link from "next/link";
import { PeopleLinks } from "./PeopleLinks";
import { HeroBackdrop, Row } from "./DetailParts";
import { BorrowOnline } from "./BorrowOnline";
import { ExternalLink } from "lucide-react";
import type { Title } from "@/lib/types";
import { similarTitles } from "@/lib/catalog";
import { toCard } from "@/lib/card";
import { browseHref } from "@/lib/modes";
import {
  CERT_STYLES,
  formatRuntime,
  formatSeries,
  isEItem,
  borrowLink,
  posterUrl,
  tidySummary,
  trailerId,
  trailerSearchUrl,
} from "@/lib/format";
import { Poster } from "./Poster";
import { MyListButton } from "./MyListButton";
import { LiveAvailability } from "./LiveAvailability";
import { FilteredGrid } from "./FilteredGrid";
import { Ratings } from "./Ratings";
import { TrailerButton } from "./Trailer";

export function TitleDetail({
  t,
  headingLevel = "h1",
}: {
  t: Title;
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const borrow = borrowLink(t);
  const record = borrow.href;
  const art = posterUrl(t);
  const similar = similarTitles(t, 36).map(toCard);
  const by = t.kind === "film" ? t.directors : (t.authors ?? []);

  return (
    <article>
      <div className="relative overflow-hidden bg-paper-2">
        <HeroBackdrop art={art} />
        <div className="relative flex flex-col gap-6 p-5 pt-10 sm:flex-row sm:items-end sm:p-8 sm:pt-12">
          <div className="w-36 shrink-0 shadow-xl sm:w-48">
            <Poster src={art} title={t.title} year={t.year} eager />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
              {t.format}
            </p>
            <Heading className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
              {t.title}
            </Heading>
            {by.length > 0 && (
              <p className="text-muted">
                {t.kind === "film" ? "Directed by " : "by "}
                <PeopleLinks names={by.slice(0, 3)} kind={t.kind} />
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {t.certificate && (
                <span
                  className={`rounded px-1.5 text-xs font-bold leading-5 ${CERT_STYLES[t.certificate] ?? "bg-slate-500 text-white"}`}
                  title={`BBFC ${t.certificate}`}
                >
                  {t.certificate}
                </span>
              )}
              {t.year && <span>{t.year}</span>}
              {formatRuntime(t.runtimeMins) && (
                <span>· {formatRuntime(t.runtimeMins)}</span>
              )}
              {t.pages ? <span>· {t.pages} pages</span> : null}
              {t.series && <span>· {formatSeries(t.series)}</span>}
            </div>
            <Ratings extras={t.extras} />
            <div className="flex flex-wrap gap-3 pt-1">
              {record && (
                <a
                  href={record}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-full bg-sea px-5 py-2.5 font-semibold text-on-sea transition hover:bg-sea-dark"
                >
                  {borrow.label}{" "}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {t.kind === "film" && (
                <TrailerButton
                  title={t.title}
                  youtubeId={trailerId(t)}
                  searchUrl={trailerSearchUrl(t)}
                />
              )}
              <MyListButton irn={t.irn} />
            </div>
            {!isEItem(t) && (
              <p className="text-xs text-muted">On the shelf? Just pop in.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 bg-card p-5 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
        {/* First in the DOM so phones (one column) read and tab to it before the synopsis. */}
        <aside className="lg:col-start-2 lg:row-start-1">
          {isEItem(t) ? (
            <BorrowOnline
              title={t.title}
              format={t.format}
              isbn={t.isbn ?? null}
              coverUrl={t.coverUrl}
              author={t.authors?.[0] ?? null}
            />
          ) : (
            <LiveAvailability
              irn={t.irn}
              initial={t.holdings}
              snapshot={{ available: t.available, copies: t.copies }}
            />
          )}
        </aside>
        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
          {t.summary ? (
            <p className="text-base leading-relaxed">
              {tidySummary(t.summary)}
            </p>
          ) : (
            <p className="text-muted">
              No description from the library for this one.
            </p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {t.cast.length > 0 && (
              <Row label="Cast">
                <PeopleLinks names={t.cast.slice(0, 10)} kind={t.kind} />
              </Row>
            )}
            {t.narrators && t.narrators.length > 0 && (
              <Row label="Read by">
                <PeopleLinks names={t.narrators} kind={t.kind} />
              </Row>
            )}
            {t.genres.length > 0 && (
              <Row label="Genres">
                <span className="flex flex-wrap gap-1.5">
                  {t.genres.map((g) => (
                    <Link
                      key={g}
                      href={browseHref(t.kind, { genre: g })}
                      className="rounded-full bg-paper-2 px-2.5 py-0.5 text-xs hover:bg-sea hover:text-on-sea"
                    >
                      {g}
                    </Link>
                  ))}
                </span>
              </Row>
            )}
            {t.languages.length > 0 && (
              <Row label="Language">{t.languages.join(", ")}</Row>
            )}
            {t.publisher && <Row label="Publisher">{t.publisher}</Row>}
            {t.isbn && <Row label="ISBN">{t.isbn}</Row>}
          </dl>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="bg-card px-5 pb-8 sm:px-8">
          <h3 className="mb-3 font-display text-xl font-semibold">
            More like this
          </h3>
          <FilteredGrid items={similar} />
        </section>
      )}
    </article>
  );
}
