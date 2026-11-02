// Pure matching/normalisation logic for scripts/enrich.ts. No I/O here.
import type { FilmExtras, Title } from "../types";

export type CatalogueFilm = Pick<
  Title,
  "irn" | "title" | "year" | "releaseYear" | "directors" | "cast" | "genres"
>;

export type Rank = "preferred" | "normal" | "deprecated";
export type EntityKind = "film" | "tv" | "other";

export interface WdValue {
  value: string;
  rank: Rank;
}

export interface WdReviewScore extends WdValue {
  by: string; // P447 QID
  method: string | null; // P459 QID
  date: string | null; // P585
}

export interface WdVideo extends WdValue {
  role: string | null; // P3831 QID
  lang: string | null; // P407 QID
  date: string | null; // P585
  seconds: number | null; // P2047, normalised
  title: string | null; // P1476
}

/** Trimmed Wikidata entity: everything matching and extras need. */
export interface WdCandidate {
  id: string;
  label: string | null;
  aliases: string[];
  enwiki: string | null;
  p31: string[];
  dates: string[]; // P577, ISO
  directors: string[]; // en/mul labels of P57
  cast: string[]; // en/mul labels of P161
  imdb: WdValue[];
  rottenTomatoes: WdValue[];
  scores: WdReviewScore[];
  videos: WdVideo[];
}

export const Q = {
  rottenTomatoes: "Q105584",
  metacritic: "Q150248",
  tomatometer: "Q108403393",
  metascore: "Q106515043",
  trailer: "Q622550",
  english: "Q1860",
} as const;

// ---------- normalisation ----------

export function foldDiacritics(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "d");
}

const LEADING_ARTICLE =
  /^(the|a|an|le|la|les|l|el|il|lo|der|die|das|den|det)\s+/;

/** Comparison key for titles: case, punctuation, diacritics, "&", leading article. */
export function normaliseTitle(s: string): string {
  const t = foldDiacritics(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return t.replace(LEADING_ARTICLE, "");
}

/** Person name tokens: folded, initials split ("D.W." -> d w). */
export function personTokens(name: string): string[] {
  // Catalogue has mis-decoded MARC-8 diacritics mid-word ("AlmodÔovar", "KaurismÞaki").
  return foldDiacritics(name.normalize("NFC").replace(/(?<=[a-z])[ÔÞ](?=[a-z])/g, ""))
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t && !/^(jr|sr|ii|iii)$/.test(t));
}

/**
 * Same surname and compatible first initial, or the same letters with the family
 * name moved to the front ("Chang-dong Lee" = "Lee Chang-dong", "Zhangke Jia" = "Jia Zhang-Ke").
 */
export function samePerson(a: string, b: string): boolean {
  const x = personTokens(a);
  const y = personTokens(b);
  if (!x.length || !y.length) return false;
  const joined = (t: string[]) => t.join("");
  const rotated = (t: string[]) => joined([t[t.length - 1], ...t.slice(0, -1)]);
  if (joined(x) === joined(y) || rotated(x) === joined(y) || joined(x) === rotated(y)) return true;
  if (x.length < 2 || y.length < 2) return false;
  return x[x.length - 1] === y[y.length - 1] && x[0][0] === y[0][0];
}

export function peopleOverlap(a: string[], b: string[]): number {
  return a.filter((p) => b.some((q) => samePerson(p, q))).length;
}

// ---------- catalogue title parsing ----------

const ORDINALS: Record<string, number> = {
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
};

function parseNumberWord(w: string | undefined): number | null {
  if (!w) return null;
  const n = parseInt(w, 10);
  if (!Number.isNaN(n)) return n;
  return ORDINALS[w.toLowerCase()] ?? null;
}

const EDITION_SUFFIX =
  /\s*(?:[-:,]\s*)?(?:the\s+)?(?:masters of cinema series|director'?s cut|final cut|remastered|special edition|collector'?s edition|extended (?:edition|cut)|ultimate edition|(?:\d+(?:st|nd|rd|th)\s+)?anniversary edition|criterion collection)\s*$/i;

const MULTI_SET =
  /\/|\bcollection\b|\btrilogy\b|\bquadrilogy\b|\bbox ?set\b|\bdouble bill\b|\bother stories\b|\bfilms?\s*\d|\b\d+\s*(?:film|movie)s?\b|\bvolume\b|\bvol\.|\bfavourites\b/i;

const NUM = `\\d+|${Object.keys(ORDINALS).join("|")}`;
const SEASON = new RegExp(
  `^(.*?)[\\s:,.-]*(?:the\\s+)?(?:absolutely\\s+)?(?:complete\\s+)?(?:(${NUM})(?:st|nd|rd|th)?\\s+)?(series|season)(?:\\s+(${NUM}))?\\b(.*)$`,
  "i",
);

export interface ParsedTitle {
  /** Title with brackets/edition suffixes removed. */
  base: string;
  /** Year given as "(2025)" in the title. */
  yearHint: number | null;
  /** Box set of several films or episode compilation: never matched. */
  multi: boolean;
  /** Season/series box set: matched against the TV series entity. */
  season: { seriesName: string; number: number | null } | null;
}

export function parseCatalogueTitle(title: string): ParsedTitle {
  let base = title.replace(/\[[^\]]*\]/g, " ");
  let yearHint: number | null = null;
  base = base.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const m = inner.trim().match(/^(\d{4})$/);
    if (m) yearHint = parseInt(m[1], 10);
    return " ";
  });
  base = base.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) base = base.replace(EDITION_SUFFIX, "").trim();
  base = base.replace(/[\s:;,-]+$/, "").trim();

  let season: ParsedTitle["season"] = null;
  const m = base.match(SEASON);
  if (m && m[1].trim()) {
    const before = parseNumberWord(m[2]);
    const after = parseNumberWord(m[4]);
    // "Series 3", "Season four", "The complete second season"
    const number = before ?? after;
    if (number !== null || /^\s*$/.test(m[5] ?? "")) {
      season = { seriesName: m[1].replace(/[\s:;,.-]+$/, "").trim(), number };
    }
  }
  const multi = MULTI_SET.test(base);
  return { base, yearHint, multi, season };
}

export type VariantKind = "full" | "partial" | "series";
export interface TitleVariant {
  text: string;
  kind: VariantKind;
}

/** Strings to search for / compare against, strongest first. */
export function titleVariants(p: ParsedTitle): TitleVariant[] {
  if (p.multi) return [];
  if (p.season) return [{ text: p.season.seriesName, kind: "series" }];
  const out: TitleVariant[] = [{ text: p.base, kind: "full" }];
  // "Charlie Chaplin: Limelight" -> both halves, but halves need extra evidence.
  const split = p.base.match(/^(.+?)\s*(?::| - | – )\s*(.+)$/);
  if (split) {
    for (const part of [split[2], split[1]]) {
      if (normaliseTitle(part).length >= 3)
        out.push({ text: part.trim(), kind: "partial" });
    }
  }
  return out;
}

export function isTvTitle(t: CatalogueFilm, p: ParsedTitle): boolean {
  return t.genres.includes("TV") || p.season !== null;
}

// ---------- candidate evaluation ----------

export function classify(
  p31: string[],
  filmClasses: Set<string>,
  tvClasses: Set<string>,
  episodeClasses: Set<string>,
): EntityKind {
  if (p31.some((c) => episodeClasses.has(c))) return "other";
  if (p31.some((c) => filmClasses.has(c))) return "film";
  if (p31.some((c) => tvClasses.has(c))) return "tv";
  return "other";
}

export function candidateYears(c: Pick<WdCandidate, "dates">): number[] {
  return [
    ...new Set(
      c.dates
        .map((d) => parseInt(d.replace(/^\+/, "").slice(0, 4), 10))
        .filter((y) => y > 1850),
    ),
  ].sort((a, b) => a - b);
}

export interface Evaluation {
  id: string;
  score: number; // 0 = reject
  tier: string;
  via: VariantKind;
  reason: string;
}

export interface EvalContext {
  film: CatalogueFilm;
  parsed: ParsedTitle;
  kind: EntityKind;
}

function titleMatches(variant: string, c: WdCandidate): boolean {
  const v = normaliseTitle(variant);
  if (!v) return false;
  return [c.label, ...c.aliases].some(
    (n) => n !== null && normaliseTitle(n) === v,
  );
}

/**
 * Scores one candidate against one title variant. Tiers:
 *  90 exact title + director overlap + plausible year
 *  75 exact title + cast overlap + year ±1, no director conflict
 *  70 partial title + director/2 cast overlap + year ±1
 *  65 season box set -> TV series with plausible start year
 *  60 exact title + same year, director data on one side only
 */
export function evaluateCandidate(
  ctx: EvalContext,
  variant: TitleVariant,
  c: WdCandidate,
): Evaluation {
  const { film, parsed, kind } = ctx;
  const reject = (reason: string): Evaluation => ({
    id: c.id,
    score: 0,
    tier: "-",
    via: variant.kind,
    reason,
  });

  if (kind === "other") return reject("not a film/TV entity");
  if (!titleMatches(variant.text, c)) return reject("title differs");

  const years = candidateYears(c);
  const first = years[0] ?? null;
  const dirs =
    film.directors.length && c.directors.length
      ? peopleOverlap(film.directors, c.directors)
      : null;
  const dirConflict = dirs === 0;
  const castN =
    film.cast.length && c.cast.length ? peopleOverlap(film.cast, c.cast) : 0;

  // Year distance: closest of any P577 year to the film year (and the "(2025)" hint).
  const hints = [parsed.yearHint ?? film.year].filter(
    (y): y is number => y !== null,
  );
  const yd =
    years.length && hints.length
      ? Math.min(...years.flatMap((y) => hints.map((h) => Math.abs(y - h))))
      : null;
  if (parsed.yearHint !== null && (yd === null || yd > 1))
    return reject("year hint mismatch");
  // Film can't premiere after the DVD was printed.
  if (
    first !== null &&
    film.releaseYear !== null &&
    first > film.releaseYear + 1
  )
    return reject("after DVD release");
  // When year == releaseYear the library likely only knows the DVD year; film may be older.
  const yearKnown = film.year !== null && film.year !== film.releaseYear;
  const dvdYearOnly = film.year !== null && film.year === film.releaseYear;
  const loose =
    yd === null ||
    yd <= 2 ||
    (dvdYearOnly && first !== null && first <= film.releaseYear!);
  const close =
    yd !== null &&
    (yd <= 1 ||
      (dvdYearOnly &&
        first !== null &&
        first >= film.releaseYear! - 2 &&
        first <= film.releaseYear!));
  const exactYear =
    yd === 0 ||
    (!yearKnown &&
      dvdYearOnly &&
      first !== null &&
      first >= film.releaseYear! - 1 &&
      first <= film.releaseYear!);

  const isTv = isTvTitle(film, parsed);
  const ok = (score: number, tier: string, reason: string): Evaluation => ({
    id: c.id,
    score,
    tier,
    via: variant.kind,
    reason,
  });

  if (variant.kind === "series") {
    if (kind !== "tv") return reject("series title but entity is not TV");
    if (dirConflict && castN === 0) return reject("director conflict");
    if (first === null || film.year === null)
      return reject("no years to compare");
    const n = parsed.season?.number ?? 1;
    const lo = film.year - (2 * n + 2);
    if (first > film.year + 1 || first < lo)
      return reject(`series start ${first} outside window`);
    return ok(
      castN > 0 ? 68 : 65,
      "series",
      `TV series, start ${first}, cast overlap ${castN}`,
    );
  }

  // Film catalogue entry vs TV entity (or vice versa) needs director evidence.
  const kindMismatch = (isTv && kind === "film") || (!isTv && kind === "tv");

  if (variant.kind === "partial") {
    if (dirConflict) return reject("director conflict");
    if (!close) return reject(`year distance ${yd}`);
    if ((dirs ?? 0) > 0 || castN >= 2)
      return ok(70, "partial", `half title, dirs ${dirs}, cast ${castN}`);
    return reject("half title without people evidence");
  }

  if ((dirs ?? 0) > 0) {
    if (!loose) return reject(`director ok but year distance ${yd}`);
    return ok(90, "director", `director overlap, year distance ${yd}`);
  }
  if (dirConflict) return reject("director conflict");
  if (kindMismatch) return reject(`kind mismatch (${kind}) without director`);
  if (castN > 0 && close)
    return ok(75, "cast", `cast overlap ${castN}, year distance ${yd}`);
  if (exactYear)
    return ok(60, "year", `same year ${first}, no director data on one side`);
  return reject(`year distance ${yd} without people evidence`);
}

export interface Decision {
  qid: string | null;
  score: number;
  via: VariantKind | null;
  reason: string;
}

/** Best candidate, or null when nothing passes or the top tier is shared. */
export function chooseMatch(evals: Evaluation[]): Decision {
  const best = new Map<string, Evaluation>();
  for (const e of evals) {
    if (e.score <= 0) continue;
    const prev = best.get(e.id);
    if (!prev || e.score > prev.score) best.set(e.id, e);
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    const titled = evals.filter((e) => e.reason !== "title differs");
    const why = titled.length
      ? titled
          .map((e) => `${e.id}: ${e.reason}`)
          .slice(0, 4)
          .join("; ")
      : "no title match";
    return { qid: null, score: 0, via: null, reason: why };
  }
  if (ranked.length > 1 && ranked[1].score >= ranked[0].score) {
    return {
      qid: null,
      score: 0,
      via: null,
      reason: `ambiguous: ${ranked
        .slice(0, 3)
        .map((e) => e.id)
        .join(", ")}`,
    };
  }
  const top = ranked[0];
  return { qid: top.id, score: top.score, via: top.via, reason: top.reason };
}

// ---------- extracting extras ----------

const RANK_ORDER: Record<Rank, number> = {
  preferred: 0,
  normal: 1,
  deprecated: 2,
};

/** Preferred-rank value, else the only distinct normal one. Ambiguous -> null. */
export function pickId(
  values: WdValue[],
  valid: (v: string) => boolean = () => true,
): string | null {
  const live = values.filter((v) => v.rank !== "deprecated" && valid(v.value));
  const pref = [
    ...new Set(live.filter((v) => v.rank === "preferred").map((v) => v.value)),
  ];
  if (pref.length === 1) return pref[0];
  if (pref.length > 1) return null;
  const normal = [...new Set(live.map((v) => v.value))];
  return normal.length === 1 ? normal[0] : null;
}

export function parsePercent(v: string): number | null {
  const m = v.trim().match(/^(\d{1,3})(?:\.\d+)?\s*%$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n <= 100 ? n : null;
}

export function parseOutOf100(v: string): number | null {
  const m = v.trim().match(/^(\d{1,3})\s*\/\s*100$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n <= 100 ? n : null;
}

function sortStatements<T extends WdValue & { date: string | null }>(
  xs: T[],
): T[] {
  return [...xs].sort(
    (a, b) =>
      RANK_ORDER[a.rank] - RANK_ORDER[b.rank] ||
      (b.date ?? "").localeCompare(a.date ?? ""),
  );
}

/** Most recent non-deprecated Tomatometer % (audience score and x/10 averages excluded). */
export function pickRottenTomatoesScore(
  scores: WdReviewScore[],
): number | null {
  const xs = scores.filter(
    (s) =>
      s.by === Q.rottenTomatoes &&
      s.rank !== "deprecated" &&
      (s.method === Q.tomatometer || s.method === null) &&
      parsePercent(s.value) !== null,
  );
  const top = sortStatements(xs)[0];
  return top ? parsePercent(top.value) : null;
}

export function pickMetacriticScore(scores: WdReviewScore[]): number | null {
  const xs = scores.filter(
    (s) =>
      s.by === Q.metacritic &&
      s.rank !== "deprecated" &&
      (s.method === Q.metascore || s.method === null) &&
      parseOutOf100(s.value) !== null,
  );
  const top = sortStatements(xs)[0];
  return top ? parseOutOf100(top.value) : null;
}

const MAX_TRAILER_SECONDS = 330;

/**
 * Whether a P1651 statement is a trailer. Untagged statements are often full films
 * (rental listings, Mosfilm uploads), so they need a short duration or "trailer" title.
 */
export function isTrailer(v: WdVideo): boolean {
  if (v.role !== null) return v.role === Q.trailer;
  if (v.title && /trailer|teaser|bande[- ]annonce|tráiler/i.test(v.title))
    return true;
  return (
    v.seconds !== null && v.seconds > 0 && v.seconds <= MAX_TRAILER_SECONDS
  );
}

export function pickTrailer(videos: WdVideo[]): string | null {
  const xs = videos.filter(
    (v) =>
      v.rank !== "deprecated" &&
      /^[A-Za-z0-9_-]{11}$/.test(v.value) &&
      isTrailer(v),
  );
  xs.sort(
    (a, b) =>
      RANK_ORDER[a.rank] - RANK_ORDER[b.rank] ||
      Number(b.lang === Q.english) - Number(a.lang === Q.english) ||
      Number(b.role === Q.trailer) - Number(a.role === Q.trailer) ||
      (b.date ?? "").localeCompare(a.date ?? ""),
  );
  return xs[0]?.value ?? null;
}

export function wikipediaUrl(title: string | null): string | null {
  if (!title) return null;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/**
 * Season box sets match the whole series, whose RT/Metacritic scores are usually for
 * one season or an aggregate, so scores are dropped for them.
 */
export function buildExtras(c: WdCandidate, via: VariantKind): FilmExtras {
  const series = via === "series";
  return {
    wikidataId: c.id,
    imdbId: pickId(c.imdb, (v) => /^tt\d{7,}$/.test(v)),
    imdbRating: null,
    rottenTomatoesId: pickId(c.rottenTomatoes, (v) =>
      /^(m|tv)\/[\w-]+/.test(v),
    ),
    rottenTomatoesScore: series ? null : pickRottenTomatoesScore(c.scores),
    metacriticScore: series ? null : pickMetacriticScore(c.scores),
    youtubeTrailerId: pickTrailer(c.videos),
    wikipediaUrl: wikipediaUrl(c.enwiki),
  };
}

/** Changes when the catalogue fields used for matching change. */
/** Cast as matched against; only unmatched titles re-match when it changes (it can add evidence). */
export const castKey = (t: CatalogueFilm) => t.cast.join(";");

/** Undecided, record changed, or unmatched with a different cast. */
export function needsMatch(d: { fingerprint: string; qid: string | null; cast?: string } | undefined, t: CatalogueFilm) {
  return !d || d.fingerprint !== fingerprint(t) || (!d.qid && d.cast !== castKey(t));
}

export function fingerprint(t: CatalogueFilm): string {
  return [
    t.title,
    t.year,
    t.releaseYear,
    t.directors.join(";"),
    t.genres.includes("TV") ? "tv" : "",
  ].join("|");
}
