import type { Branch, FilmExtras, Kind, Title } from "./types";
import { availabilityLabel, creatorsOf, formatRuntime, isOnOrder, posterUrl } from "./format";

/** Minimal title shape sent to the client for cards and search. */
export interface CardTitle {
  irn: string;
  kind: Kind;
  title: string;
  /** Author for books/audiobooks, director for films. Shown under the cover. */
  byline: string | null;
  year: number | null;
  poster: string | null;
  certificate: string | null;
  genres: string[];
  available: number;
  copies: number;
  format: Title["format"];
  rtScore: number | null;
  branches: Branch[];
  availableAt: Branch[];
  audience: Title["audience"];
  /** Every copy is still on order (not arrived yet, but reservable). */
  onOrder: boolean;
}

export interface SearchTitle extends CardTitle {
  sortTitle: string;
  people: string[]; // directors, cast, authors, narrators
  languages: string[];
  firstSeen: string;
}


export function toCard(t: Title): CardTitle {
  return {
    irn: t.irn,
    kind: t.kind,
    title: t.title,
    byline: creatorsOf(t)[0] ?? null,
    year: t.year,
    poster: posterUrl(t),
    certificate: t.certificate,
    genres: t.genres.slice(0, 3),
    available: t.available,
    copies: t.copies,
    format: t.format,
    rtScore: t.extras?.rottenTomatoesScore ?? null,
    branches: t.branches,
    availableAt: t.availableAt,
    audience: t.audience,
    onOrder: isOnOrder(t),
  };
}

export function toSearch(t: Title): SearchTitle {
  return {
    ...toCard(t),
    genres: t.genres,
    sortTitle: t.sortTitle,
    people: [
      ...t.directors,
      ...t.cast.slice(0, 8),
      ...(t.authors ?? []),
      ...(t.narrators ?? []),
    ],
    languages: t.languages,
    firstSeen: t.firstSeen,
  };
}

/** A featured title for the home carousel. */
export interface FeatureTitle extends CardTitle {
  summary: string | null;
  meta: string[]; // e.g. ["2025", "1h 53m", "Drama"]
  availability: string;
  extras: FilmExtras | null;
}

export function toFeature(t: Title): FeatureTitle {
  return {
    ...toCard(t),
    summary: t.summary,
    meta: [t.year ? String(t.year) : null, formatRuntime(t.runtimeMins), ...t.genres.slice(0, 2)].filter(
      (x): x is string => Boolean(x),
    ),
    availability: availabilityLabel(t),
    extras: t.extras ?? null,
  };
}
