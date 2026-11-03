import type { Kind } from "./types";

export type ModeSlug = "films" | "books" | "audiobooks";

export interface Mode {
  kind: Kind;
  slug: ModeSlug;
  label: string;
  short: string;
  home: string;
  /** What the collection is, for headings like "Every … in the library". */
  noun: string;
}

export const MODES: Mode[] = [
  {
    kind: "film",
    slug: "films",
    label: "Films & TV",
    short: "Films",
    home: "/",
    noun: "film and TV series",
  },
  {
    kind: "book",
    slug: "books",
    label: "Books",
    short: "Books",
    home: "/books",
    noun: "book",
  },
  {
    kind: "audiobook",
    slug: "audiobooks",
    label: "Audiobooks",
    short: "Audio",
    home: "/audiobooks",
    noun: "audiobook",
  },
];

export const modeByKind = (kind: Kind): Mode =>
  MODES.find((m) => m.kind === kind)!;
export const modeBySlug = (slug: string): Mode | undefined =>
  MODES.find((m) => m.slug === slug);

export const browseHref = (kind: Kind, params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  return `/browse/${modeByKind(kind).slug}${qs}`;
};

/** Which mode a pathname belongs to, or null for shared pages (title, my list, about). */
export function modeFromPath(pathname: string): Mode | null {
  if (pathname === "/") return MODES[0];
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first === "browse" || first === "search")
    return modeBySlug(second ?? "") ?? null;
  return modeBySlug(first) ?? null;
}

/** Book prizes, showing books or audiobooks (from `?for=`), optionally at a prize's section. */
export const prizesHref = (kind?: Kind, anchor?: string) => {
  const slug = kind === "book" || kind === "audiobook" ? modeByKind(kind).slug : null;
  return `/prizes${slug ? `?for=${slug}` : ""}${anchor ? `#${anchor}` : ""}`;
};
