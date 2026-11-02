// Shared contract between the Spydus sync script and the UI.

export type Branch =
  | "Jubilee Library"
  | "Hove Library"
  | "Patcham Library"
  | "Hangleton Library"
  | "Portslade Library"
  | (string & {});

export interface Holding {
  branch: Branch;
  /** Second location line, e.g. "Jubilee Library Store" (stack copy, ask staff). */
  subLocation?: string | null;
  collection: string; // e.g. "DVD 15 premier", "DVD U/PG/E"
  callNumber: string;
  status: string; // raw Spydus text, e.g. "On loan - Due: 05 Nov 2026"
  available: boolean;
  dueDate: string | null; // ISO date (YYYY-MM-DD) when on loan
}

/** Which catalogue/mode an item belongs to. Each kind has its own data file. */
export type Kind = "film" | "book" | "audiobook";

export type Format =
  | "DVD"
  | "Blu-ray"
  | "DVD box set"
  | "Book"
  | "Large print"
  | "Audiobook CD"
  | "eAudiobook"
  | "eBook";

export interface Title {
  kind: Kind;
  /** Spydus internal record number. Used in our URLs. */
  irn: string;
  /** Bib record number. Used for deep links back to the library (robots-allowed path). */
  brn: string | null;
  title: string; // cleaned, no "[videorecording]"
  sortTitle: string; // lowercased, leading article stripped
  /** Film year ("Made in 1984") when known, else release year. */
  year: number | null;
  releaseYear: number | null; // DVD imprint year
  summary: string | null;
  ean: string | null;
  /** Books/audiobooks. */
  isbn?: string | null;
  /** Cover image URL exactly as the library OPAC embeds it. Render client-side only. */
  coverUrl: string | null;
  /** Films: directors and cast. Empty for books. */
  directors: string[];
  cast: string[];
  /** Books/audiobooks: authors (uninverted, e.g. "Sally Rooney"). Empty for films. */
  authors?: string[];
  /** Audiobooks: readers/narrators. */
  narrators?: string[];
  series?: string | null; // e.g. "Slow Horses ; 3"
  pages?: number | null;
  publisher?: string | null;
  runtimeMins: number | null;
  certificate: string | null; // BBFC: U, PG, 12, 12A, 15, 18, E (films only)
  genres: string[]; // normalised, e.g. "Horror", "Comedy", "Animation"
  subjects: string[]; // raw subject headings
  languages: string[];
  audience: "adult" | "children" | null;
  format: Format;
  discs: number | null;
  copies: number;
  available: number;
  /** Branches holding at least one copy, from holdings at sync time. */
  branches: Branch[];
  /** Branches with a copy on the shelf at sync time. */
  availableAt: Branch[];
  holdings: Holding[];
  /** Live record lookups only: holdings couldn't be fetched, so copies/available/branches are unknown (not 0). */
  holdingsUnknown?: boolean;
  /** ISO timestamp this IRN was first seen by our sync. */
  firstSeen: string;
  tmdb?: TmdbInfo;
  /** Films: links and scores from Wikidata/OMDb (see scripts/enrich.ts). Merged in at build. */
  extras?: FilmExtras;
}

export interface FilmExtras {
  wikidataId: string | null;
  imdbId: string | null; // "tt0086879"
  imdbRating: number | null; // 0-10, OMDb only
  rottenTomatoesId: string | null; // "m/amadeus"
  rottenTomatoesScore: number | null; // Tomatometer %, 0-100
  metacriticScore: number | null; // 0-100
  youtubeTrailerId: string | null;
  wikipediaUrl: string | null;
}

export interface TmdbInfo {
  id: number;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  trailerKey: string | null; // YouTube key
  tagline: string | null;
}

export interface Catalog {
  kind: Kind;
  generatedAt: string;
  source: string;
  titles: Title[];
}

/** Live BorrowBox loan status. available null: a status we don't recognise. */
export interface BorrowBoxStatus {
  id: string;
  available: boolean | null;
  /** YYYY-MM-DD when on loan and BorrowBox gives a date. */
  nextAvailable: string | null;
}

/** The same book on Libby, if it's in the library's OverDrive collection. */
export interface LibbyMatch {
  id: string;
  available: boolean | null;
  holds: number | null;
  waitDays: number | null;
}

/** /api/eloan response. borrowBox null: lookup failed or was rate-capped. */
export interface EloanStatus {
  borrowBox: BorrowBoxStatus | null;
  /** null with libbyFailed false: Libby doesn't have it. */
  libby: LibbyMatch | null;
  libbyFailed: boolean;
}

/** Response from /api/availability/[irn] */
export interface LiveAvailability {
  irn: string;
  fetchedAt: string;
  holdings: Holding[];
  copies: number;
  available: number;
}
