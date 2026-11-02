// Builds catalogue Titles from parsed Spydus pages. Pure (no I/O), server-side.
import type { Branch, Holding, Kind, Title } from "../types";
import {
  bookAudience,
  certificateFromCollection,
  deriveAudience,
  normaliseBookGenres,
  sortTitle,
  type BookBucket,
  type FullRecord,
  type ListRecord,
} from "./parse";

/** e-items (BorrowBox/Libby) have no physical copies, so no holdings. */
export const isEItem = (r: Pick<ListRecord, "formatIcon">) =>
  r.formatIcon === "eAudioBook" || r.formatIcon === "eBook";

const uniq = (xs: Branch[]) => [...new Set(xs)].sort();

/**
 * Build a catalogue Title from a list card, its full record (null: reuse prev), and holdings.
 * Shared by the nightly sync and the live full-catalogue record lookup.
 */
export function buildTitle(
  kind: Kind,
  rec: ListRecord,
  /** Book list bucket; null when unknown (live search), so audience comes from the record. */
  bucket: BookBucket | null,
  full: FullRecord | null,
  prev: Title | undefined,
  /** Holdings fetched this run (or offline cache); null if not fetched. */
  holdings: Holding[] | null,
  staleHoldings: Holding[] | null,
  now: string,
): Title {
  const title = full?.title || rec.title;
  const base = {
    kind,
    irn: rec.irn,
    brn: full?.brn ?? prev?.brn ?? null,
    title,
    sortTitle: sortTitle(title),
    year: full?.year ?? prev?.year ?? rec.year,
    releaseYear: full?.releaseYear ?? prev?.releaseYear ?? rec.year,
    summary: full?.summary ?? prev?.summary ?? rec.summary,
    coverUrl: rec.coverUrl ?? full?.coverUrl ?? prev?.coverUrl ?? null,
    runtimeMins: full?.runtimeMins ?? prev?.runtimeMins ?? null,
    subjects: full?.subjects ?? prev?.subjects ?? [],
    languages: full?.languages ?? prev?.languages ?? [],
    discs: full?.discs ?? prev?.discs ?? null,
    firstSeen: prev?.firstSeen ?? now,
  };

  if (kind !== "film") {
    const icon = rec.formatIcon;
    const isEaudio = icon === "eAudioBook";
    // e-items have no holdings: list counts (usually 0/0) and no branches.
    const physical = !isEItem(rec);
    const fresh = physical && holdings !== null;
    const hs = physical ? (holdings ?? staleHoldings ?? prev?.holdings ?? []) : [];
    // Without a full record (nightly CI for known titles), full-derived fields come from prev.
    let genres = full || !prev ? normaliseBookGenres(base.subjects, bucket) : prev.genres;
    let audience: Title["audience"];
    if (kind === "book" && bucket) audience = bucket === "junior" ? "children" : "adult";
    else if (full) {
      const a = bookAudience(full.audienceNote, base.subjects);
      audience = a.audience;
      if (a.youngAdult) genres = [...new Set([...genres, "Young Adult"])].sort();
      if (audience === "children") genres = [...new Set([...genres, "Children's"])].sort();
    } else audience = prev?.audience ?? "adult";
    const largePrint = icon === "Large Print" || (full ? full.largePrint : prev?.format === "Large print");
    return {
      ...base,
      ean: null,
      isbn: rec.ean ?? full?.isbn ?? prev?.isbn ?? null,
      directors: [],
      cast: [],
      authors: full?.authors ?? prev?.authors ?? [],
      narrators:
        kind === "audiobook" ? (full?.narrators ?? prev?.narrators ?? []) : [],
      series: full?.series ?? prev?.series ?? null,
      pages: kind === "book" ? (full?.pages ?? prev?.pages ?? null) : null,
      publisher: full?.publisher ?? prev?.publisher ?? null,
      certificate: null,
      genres,
      audience,
      format:
        kind === "book"
          ? icon === "eBook"
            ? "eBook"
            : largePrint
              ? "Large print"
              : "Book"
          : isEaudio
            ? "eAudiobook"
            : "Audiobook CD",
      copies: fresh && hs.length ? hs.length : rec.copies,
      available:
        fresh && hs.length
          ? hs.filter((h) => h.available).length
          : rec.available,
      branches: uniq(hs.map((h) => h.branch)),
      availableAt: fresh
        ? uniq(hs.filter((h) => h.available).map((h) => h.branch))
        : [],
      holdings: hs,
    };
  }

  // Films. Without fresh holdings, counts come from the fresh list and availableAt is left
  // empty (unknown) so it can never contradict `available`.
  const fresh = holdings !== null;
  const hs = holdings ?? staleHoldings ?? prev?.holdings ?? [];
  const collections = hs.map((h) => h.collection);
  // Without a full record, prev's cert (already collection-adjusted) beats the collection guess.
  const fromCollection = collections.map(certificateFromCollection).find(Boolean) ?? null;
  const certificate = full ? (full.certificate ?? fromCollection) : (prev?.certificate ?? fromCollection);
  const genres = full?.genres ?? prev?.genres ?? [];
  return {
    ...base,
    ean: rec.ean ?? full?.ean ?? null,
    directors: full?.directors ?? prev?.directors ?? [],
    cast: full?.cast ?? prev?.cast ?? [],
    certificate,
    genres,
    audience: deriveAudience(certificate, collections, genres, base.subjects, base.summary),
    format: full?.format ?? prev?.format ?? "DVD",
    // Holdings counts when fresh: list counts are occasionally inconsistent (e.g. 1 available of 0).
    copies: fresh && hs.length ? hs.length : rec.copies,
    available:
      fresh && hs.length ? hs.filter((h) => h.available).length : rec.available,
    branches: uniq(hs.map((h) => h.branch)),
    availableAt: fresh
      ? uniq(hs.filter((h) => h.available).map((h) => h.branch))
      : [],
    holdings: hs,
    ...(prev?.tmdb ? { tmdb: prev.tmdb } : {}),
  };
}
