// The book prizes we follow and the shape of data/prizes.json. Client-safe (no data imports).
import type { Format, Kind } from "../types";
import type { Stage } from "./wikitext";

export type { Stage };

export interface Prize {
  id: string;
  name: string;
  /** For labels on mixed rows: "Booker shortlist". */
  short: string;
  /** Children's prizes show under the Kids profile; the rest follow each book's own audience. */
  children?: boolean;
  /** Wikipedia page with the lists. A function for prizes with a page per year. */
  page: string | ((year: number) => string);
  /** Stage for rows that don't say (per-year Booker pages leave the longlist uncoloured). */
  defaultStage: Stage;
  /** Official site, for "about this prize" links. */
  site: string;
}

// Order is the order on the prizes page.
export const PRIZES: Prize[] = [
  {
    id: "booker",
    short: "Booker",
    name: "Booker Prize",
    page: (y) => `${y} Booker Prize`,
    defaultStage: "longlist",
    site: "https://thebookerprizes.com/",
  },
  {
    id: "womens-fiction",
    short: "Women's Prize",
    name: "Women's Prize for Fiction",
    page: "List of Women's Prize for Fiction winners",
    defaultStage: "shortlist",
    site: "https://womensprize.com/",
  },
  {
    id: "international-booker",
    short: "International Booker",
    name: "International Booker Prize",
    page: "International Booker Prize",
    defaultStage: "longlist",
    site: "https://thebookerprizes.com/",
  },
  {
    id: "waterstones",
    short: "Waterstones",
    name: "Waterstones Book of the Year",
    page: "Waterstones Book of the Year",
    defaultStage: "shortlist",
    site: "https://www.waterstones.com/",
  },
  {
    id: "nero",
    short: "Nero",
    name: "Nero Book Awards",
    page: "Nero Book Awards",
    defaultStage: "shortlist",
    site: "https://nerobookawards.com/",
  },
  {
    id: "baillie-gifford",
    short: "Baillie Gifford",
    name: "Baillie Gifford Prize for Non-Fiction",
    page: "Baillie Gifford Prize",
    defaultStage: "shortlist",
    site: "https://thebailliegiffordprize.co.uk/",
  },
  {
    id: "womens-nonfiction",
    short: "Women's Non-Fiction",
    name: "Women's Prize for Non-Fiction",
    page: "Women's Prize for Non-Fiction",
    defaultStage: "shortlist",
    site: "https://womensprize.com/",
  },
  {
    id: "carnegie",
    short: "Carnegie",
    name: "Carnegie Medal for Writing",
    children: true,
    page: "Carnegie Medal for Writing",
    // The 1936-on winners table has no Result column.
    defaultStage: "winner",
    site: "https://carnegies.co.uk/",
  },
  {
    id: "waterstones-childrens",
    short: "Waterstones Children's",
    name: "Waterstones Children's Book Prize",
    children: true,
    page: "Waterstones Children's Book Prize",
    defaultStage: "shortlist",
    site: "https://www.waterstones.com/",
  },
];

export const prizeById = (id: string) => PRIZES.find((p) => p.id === id);

/** How many of each prize's most recent years we follow. */
export const YEARS_KEPT = 2;

export const STAGE_LABEL: Record<Stage, string> = {
  winner: "Winner",
  shortlist: "Shortlisted",
  longlist: "Longlisted",
};

/** A library record that holds a prize book. */
export interface PrizeMatch {
  irn: string;
  brn: string | null;
  kind: Extract<Kind, "book" | "audiobook">;
  format: Format;
}

export interface PrizeEntry {
  /** prize|year|folded title */
  id: string;
  prize: string;
  year: number;
  stage: Stage;
  title: string;
  /** Display name first, then alternatives (Wikipedia link targets) used for matching. */
  authors: string[];
  /** e.g. "Older Fiction · Shortlist". */
  note: string;
  /** Children's book, from the prize or its category. */
  children: boolean;
  firstSeen: string;
  /** Last library search for it; null if never searched (it was found in our own index). */
  searched: { at: string; tries: number } | null;
  matches: PrizeMatch[];
}

export interface PrizesFile {
  /** When the lists were last fetched from Wikipedia. */
  checkedAt: string | null;
  entries: PrizeEntry[];
}

export const prizeAnchor = (prize: string, year: number) => `${prize}-${year}`;
