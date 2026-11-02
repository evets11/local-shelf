import { urls } from "./spydus/urls";
import type { Title } from "./types";

export { SPYDUS_BASE } from "./spydus/urls";

/** Robots-allowed bookmark link to the record on the library catalogue. */
export function libraryUrl(t: Pick<Title, "brn">): string | null {
  return t.brn ? urls.publicRecord(t.brn) : null;
}

const TMDB_IMG = "https://image.tmdb.org/t/p";

export function posterUrl(t: Pick<Title, "coverUrl" | "tmdb">): string | null {
  if (t.tmdb?.posterPath) return `${TMDB_IMG}/w342${t.tmdb.posterPath}`;
  return t.coverUrl;
}

export function backdropUrl(t: Pick<Title, "tmdb">): string | null {
  return t.tmdb?.backdropPath
    ? `${TMDB_IMG}/w1280${t.tmdb.backdropPath}`
    : null;
}

export function formatRuntime(mins: number | null): string | null {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export const CERT_STYLES: Record<string, string> = {
  U: "bg-emerald-600 text-white",
  PG: "bg-amber-400 text-ink",
  "12": "bg-orange-500 text-white",
  "12A": "bg-orange-500 text-white",
  "15": "bg-pink-600 text-white",
  "18": "bg-red-700 text-white",
  E: "bg-slate-500 text-white",
};

export function availabilityLabel(
  t: Pick<Title, "available" | "copies"> & { format?: Title["format"] },
): string {
  if (t.format && isEItem({ format: t.format })) return "Borrow online with BorrowBox or Libby";
  if (t.copies === 0) return "No copies listed";
  if (t.available === 0) return "None on the shelf right now";
  return `${t.available} of ${t.copies} on the shelf`;
}

/** Fees from brighton-hove.gov.uk/libraries-leisure-and-arts/libraries/fees-library-services */
export const FEES = {
  adultDvd: "£3 or £4 for 1 week",
  adultBoxSet: "£6 for 1 week",
  childDvd: "£1.85 for 1 week",
  adultSpokenWord: "£1.65 for 3 weeks",
  reserveAdult: "£1.30",
  reserveChild: "60p",
};

/** What it costs to borrow. Fees depend on who's borrowing, so show both where they differ. */
export function feeFor(t: Pick<Title, "format" | "kind">): string {
  switch (t.format) {
    case "eAudiobook":
    case "eBook":
      return "Free with your library card";
    case "Book":
    case "Large print":
      return "Free";
    case "Audiobook CD":
      return `Adults ${FEES.adultSpokenWord}, free for under-16s`;
    case "DVD box set":
      return `Adults ${FEES.adultBoxSet}, children ${FEES.childDvd}`;
    default:
      return `Adults ${FEES.adultDvd}, children ${FEES.childDvd}`;
  }
}

export const imdbUrl = (id: string) => `https://www.imdb.com/title/${encodeURIComponent(id)}/`;
// RT ids look like "m/amadeus" or "tv/slow_horses"; keep the slash.
export const rottenTomatoesUrl = (id: string) =>
  `https://www.rottentomatoes.com/${id.split("/").map(encodeURIComponent).join("/")}`;

export function trailerSearchUrl(t: Pick<Title, "title" | "year">): string {
  const q = [t.title, t.year, "trailer"].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/** YouTube id for an embeddable trailer, if we know one. */
export function trailerId(t: Pick<Title, "tmdb" | "extras">): string | null {
  return t.tmdb?.trailerKey ?? t.extras?.youtubeTrailerId ?? null;
}

export function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Digital loans (BorrowBox/Libby): no shelves, available to everyone. */
export const isEItem = (t: Pick<Title, "format">) => t.format === "eAudiobook" || t.format === "eBook";

/** Every copy is still on order: not arrived yet, but reservable. */
export const isOnOrder = (t: Pick<Title, "holdings">) =>
  t.holdings.length > 0 && t.holdings.every((h) => /on order/i.test(h.status));

/** Directors for films, authors for books and audiobooks. */
export const creatorsOf = (t: Pick<Title, "kind" | "directors" | "authors">): string[] =>
  t.kind === "film" ? t.directors : (t.authors ?? []);

/** Library blurbs often lose the space between sentences ("end.The next"). */
export const tidySummary = (s: string) => s.replace(/([a-z][.!?]['"’”]?)([A-Z])/g, "$1 $2");

/** MARC series "Women's Murder Club ; 23" -> "Women's Murder Club, book 23". */
export const formatSeries = (s: string) =>
  s.replace(/\s*;\s*(\d+)\s*$/, ", book $1").replace(/\s*;\s*/g, ", ");
