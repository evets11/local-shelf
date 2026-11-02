// Matching prize-list books to library records by title and author. Pure, no I/O.
import type { Format } from "../types";
import type { PrizeMatch } from "./config";

/** Lowercase ASCII words: accents, punctuation and "&" folded, apostrophes dropped. */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const noArticle = (s: string) => s.replace(/^(?:the|a|an) /, "");

/** Title before any subtitle, folded, without a leading article. */
export function mainTitle(s: string): string {
  return noArticle(fold(s.split(/\s*[:;]\s+|\s+[-–—]\s+/)[0]));
}

/**
 * Same title? Main titles must agree, since subtitles vary between editions and Wikipedia.
 * Loose on purpose ("Lush" matches "Lush: a cookbook"); the author check does the rest.
 */
export function titleMatches(prizeTitle: string, recordTitle: string): boolean {
  const a = mainTitle(prizeTitle);
  const b = mainTitle(recordTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  // One side has no subtitle split where the other does ("Revolusi Indonesia and the…").
  const fa = noArticle(fold(prizeTitle));
  const fb = noArticle(fold(recordTitle));
  return fa === b || fb === a;
}

/** Surnames to look for: the last word of each name ("R. F. Kuang" -> "kuang"). */
export function surnames(authors: string[]): string[] {
  return [
    ...new Set(
      authors
        .map((a) => fold(a).split(" ").at(-1) ?? "")
        .filter((s) => s.length >= 2),
    ),
  ];
}

/** Does any record author share a surname with the prize book? */
export function authorMatches(
  prizeAuthors: string[],
  recordAuthors: (string | null | undefined)[],
): boolean {
  const words = new Set(
    recordAuthors.flatMap((a) => (a ? fold(a).split(" ") : [])),
  );
  return surnames(prizeAuthors).some((s) => words.has(s));
}

/** The library search for a prize book: main title plus surname, within the search length cap. */
export function searchText(title: string, authors: string[]): string {
  const surname = surnames(authors)[0] ?? "";
  const words = mainTitle(title).split(" ");
  // Keep the surname; trim title words until it fits.
  while (words.length > 1 && `${words.join(" ")} ${surname}`.length > 100)
    words.pop();
  return `${words.join(" ")} ${surname}`.trim();
}

export interface Candidate extends PrizeMatch {
  /** Copies held (0 for e-items), to prefer the best-stocked edition. */
  copies: number;
}

const FORMAT_ORDER: Format[] = [
  "Book",
  "Large print",
  "eBook",
  "Audiobook CD",
  "eAudiobook",
];

/** One record per format, best stocked first, in a stable format order. */
export function pickMatches(cands: Candidate[]): PrizeMatch[] {
  const best = new Map<Format, Candidate>();
  for (const c of cands) {
    const cur = best.get(c.format);
    if (!cur || c.copies > cur.copies) best.set(c.format, c);
  }
  return FORMAT_ORDER.flatMap((f) => {
    const c = best.get(f);
    return c
      ? [{ irn: c.irn, brn: c.brn, kind: c.kind, format: c.format }]
      : [];
  });
}
