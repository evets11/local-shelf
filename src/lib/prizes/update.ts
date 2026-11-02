// Turning Wikipedia rows into prize entries and keeping data/prizes.json up to date. Pure.
import type { Title } from "../types";
import type { ListRecord } from "../spydus/parse";
import {
  YEARS_KEPT,
  type Prize,
  type PrizeEntry,
  type PrizeMatch,
} from "./config";
import {
  authorMatches,
  fold,
  pickMatches,
  titleMatches,
  type Candidate,
} from "./match";
import { betterStage, prizeRows, STAGE_ORDER } from "./wikitext";

/** A fetched Wikipedia page; `year` for prizes with a page per year. */
export interface PrizePage {
  year: number | null;
  wikitext: string;
}

export type FreshEntry = Omit<PrizeEntry, "firstSeen" | "searched" | "matches">;


/** One prize's entries for its latest YEARS_KEPT years, deduped by title (best stage wins). */
export function entriesFromPages(
  prize: Prize,
  pages: PrizePage[],
): FreshEntry[] {
  const byId = new Map<string, FreshEntry>();
  const rows = pages.flatMap((p) =>
    prizeRows(p.wikitext).map((r) => ({ ...r, year: r.year ?? p.year })),
  );
  const years = [
    ...new Set(rows.map((r) => r.year).filter((y): y is number => y !== null)),
  ]
    .sort((a, b) => b - a)
    .slice(0, YEARS_KEPT);
  for (const r of rows) {
    if (r.year === null || !years.includes(r.year)) continue;
    const id = `${prize.id}|${r.year}|${fold(r.title)}`;
    const stage = r.stage ?? prize.defaultStage;
    const children =
      Boolean(prize.children) || /child|young|junior/i.test(r.note);
    const cur = byId.get(id);
    if (cur) {
      cur.stage = betterStage(cur.stage, stage);
      cur.children ||= children;
      cur.authors = [...new Set([...cur.authors, ...r.authors])];
      continue;
    }
    byId.set(id, {
      id,
      prize: prize.id,
      year: r.year,
      stage,
      title: r.title,
      authors: r.authors,
      note: r.note,
      children,
    });
  }
  return [...byId.values()];
}

/**
 * Should a fresh parse replace what we had? Not if it lost most of a year's books, which is
 * what a vandalised or restructured page looks like. Years that are new or gone are fine.
 */
export function looksBroken(prev: PrizeEntry[], fresh: FreshEntry[]): boolean {
  if (fresh.length === 0) return prev.length > 0;
  const count = (xs: { year: number }[], y: number) =>
    xs.filter((e) => e.year === y).length;
  return [...new Set(fresh.map((e) => e.year))].some(
    (y) => count(fresh, y) < count(prev, y) / 2,
  );
}

/** Fresh entries with what we already knew about each (first seen, searches, matches). */
export function mergeEntries(
  prev: PrizeEntry[],
  fresh: FreshEntry[],
  now: string,
): PrizeEntry[] {
  const old = new Map(prev.map((e) => [e.id, e]));
  return fresh.map((f) => {
    const o = old.get(f.id);
    return {
      ...f,
      firstSeen: o?.firstSeen ?? now,
      searched: o?.searched ?? null,
      matches: o?.matches ?? [],
    };
  });
}

type IndexTitle = Pick<
  Title,
  "irn" | "brn" | "kind" | "format" | "title" | "authors" | "copies"
>;

/** Records in our own catalogue that hold this book. */
export function indexCandidates(
  e: Pick<PrizeEntry, "title" | "authors">,
  titles: IndexTitle[],
): Candidate[] {
  return titles
    .filter(
      (t) =>
        (t.kind === "book" || t.kind === "audiobook") &&
        titleMatches(e.title, t.title) &&
        authorMatches(e.authors, t.authors ?? []),
    )
    .map((t) => ({
      irn: t.irn,
      brn: t.brn,
      kind: t.kind as PrizeMatch["kind"],
      format: t.format,
      copies: t.copies,
    }));
}

/** Records from a library search card list that hold this book (BRN unknown until fetched). */
export function searchCandidates(
  e: Pick<PrizeEntry, "title" | "authors">,
  records: {
    rec: ListRecord;
    kind: PrizeMatch["kind"];
    format: PrizeMatch["format"];
  }[],
): (Candidate & { position: number })[] {
  return records
    .filter(
      ({ rec }) =>
        titleMatches(e.title, rec.title) &&
        authorMatches(e.authors, [rec.author]),
    )
    .map(({ rec, kind, format }) => ({
      irn: rec.irn,
      brn: null,
      kind,
      format,
      copies: rec.copies,
      position: rec.position,
    }));
}

/** Add newly found records, keeping one per format (an existing match for a format stays). */
export function addMatches(
  existing: PrizeMatch[],
  found: Candidate[],
): PrizeMatch[] {
  const have = new Set(existing.map((m) => m.format));
  return pickMatches([
    ...existing.map((m) => ({ ...m, copies: Number.MAX_SAFE_INTEGER })),
    ...found.filter((c) => !have.has(c.format)),
  ]);
}

export const RETRY_DAYS = 28;
export const MAX_TRIES = 6;

/**
 * Search the library for books we haven't found: once when first listed, then about monthly for
 * a few months, since libraries often buy prize books after the shortlist.
 */
export function needsSearch(e: PrizeEntry, now: string): boolean {
  if (e.matches.length) return false;
  if (!e.searched) return true;
  const days = (Date.parse(now) - Date.parse(e.searched.at)) / 86_400_000;
  return e.searched.tries < MAX_TRIES && days >= RETRY_DAYS;
}

/** Newest years and winners first, so a capped run spends its searches on what matters most. */
export function searchOrder(a: PrizeEntry, b: PrizeEntry): number {
  return (
    b.year - a.year ||
    STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
    a.id.localeCompare(b.id)
  );
}
