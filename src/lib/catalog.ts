import "server-only";
import filmsJson from "../../data/catalog-films.json";
import booksJson from "../../data/catalog-books.json";
import audiobooksJson from "../../data/catalog-audiobooks.json";
import extrasJson from "../../data/film-extras.json";
import type { Catalog, FilmExtras, Kind, Title } from "./types";
import { browseHref, modeByKind } from "./modes";
import { creatorsOf, isEItem, isOnOrder } from "./format";
import { FEATURED_COUNT } from "./card";

export { creatorsOf };

const extras = extrasJson as Record<string, FilmExtras>;

function load(json: unknown, kind: Kind): Catalog {
  const c = json as Catalog;
  const titles = c.titles.map((t) => {
    const withKind = t.kind ? t : { ...t, kind };
    return kind === "film" && extras[t.irn]
      ? { ...withKind, extras: extras[t.irn] }
      : withKind;
  });
  return { ...c, kind, titles };
}

const catalogs: Record<Kind, Catalog> = {
  film: load(filmsJson, "film"),
  book: load(booksJson, "book"),
  audiobook: load(audiobooksJson, "audiobook"),
};

const byIrn = new Map<string, Title>();
for (const c of Object.values(catalogs))
  for (const t of c.titles) byIrn.set(t.irn, t);

const branches = (() => {
  const counts = new Map<string, number>();
  for (const t of byIrn.values())
    for (const b of t.branches)
      // "ZZ …" branches are closed sites the catalogue still lists; don't offer them as "my library".
      if (!b.startsWith("ZZ ")) counts.set(b, (counts.get(b) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
})();

/** Branches that hold anything, busiest first. */
export function getBranches(): string[] {
  return branches;
}

export function getCatalog(kind: Kind): Catalog {
  return catalogs[kind];
}

export function getTitles(kind: Kind): Title[] {
  return catalogs[kind].titles;
}

export function getAllTitles(): Title[] {
  return [...byIrn.values()];
}

/**
 * Titles whose sheet (`@modal/(.)title`) is prerendered: the newest per collection, which the
 * home pages feature. Other sheets render when first opened. Prerendering every sheet as well as
 * every page doubles the deploy (~1.4 GB to ~2.7 GB).
 */
export function getPrerenderedTitles(perKind = 100): Title[] {
  return (["film", "book", "audiobook"] as const).flatMap((kind) =>
    catalogs[kind].titles
      .filter((t) => !t.pinned)
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))
      .slice(0, perKind),
  );
}

export function getTitle(irn: string): Title | undefined {
  return byIrn.get(irn);
}

/** Genres for a kind, ordered by how many titles they have. */
export function getGenres(kind: Kind): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of catalogs[kind].titles) {
    for (const g of t.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/** Cheap deterministic hash so "random" picks are stable within a catalog build. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleStable<T extends { irn: string }>(
  items: T[],
  seed: string,
): T[] {
  return [...items].sort((a, b) => hash(seed + a.irn) - hash(seed + b.irn));
}

/** Stable partition: titles with a copy on the shelf come first. */
const onShelfFirst = (items: Title[]) => [
  ...items.filter((t) => t.available > 0),
  ...items.filter((t) => t.available === 0),
];

const hasArt = (t: Title) => Boolean(t.coverUrl || t.tmdb?.posterPath);

export interface Shelf {
  id: string;
  title: string;
  href?: string;
  items: Title[];
}

// Shelves show 30, but ship 40 so filtering by library/on-shelf prefs still fills a row.
const ROW = 40;
const SHOWN = 30;

const isKids = (t: Title) => t.audience === "children";
// What the browser can narrow a shelf to: eBooks/eAudiobooks vs print/CD, crossed with Kids.
const SLICES: ((t: Title) => boolean)[] = [
  isEItem,
  (t) => !isEItem(t),
  isKids,
  (t) => isEItem(t) && isKids(t),
  (t) => !isEItem(t) && isKids(t),
];

/**
 * A shelf's cards from its ranked candidates: the top ROW, plus the top SHOWN of each slice the
 * prefs can filter to. Shelves are filtered in the browser, so without these an eBooks-only or
 * Kids shelf would be whatever few made the overall top ROW. Keeps the ranked order.
 */
function pick(ranked: Title[]): Title[] {
  const keep = new Set(ranked.slice(0, ROW));
  for (const inSlice of SLICES) {
    let n = 0;
    for (const t of ranked) {
      if (n === SHOWN) break;
      if (inSlice(t)) {
        keep.add(t);
        n++;
      }
    }
  }
  return ranked.filter((t) => keep.has(t));
}


/** The rows on a mode's home page. */
export function getHomeShelves(kind: Kind): Shelf[] {
  const catalog = catalogs[kind];
  const seed = catalog.generatedAt.slice(0, 10);
  const titles = catalog.titles;
  const shelves: Shelf[] = [];
  if (titles.length === 0) return shelves;

  // On-order titles aren't here yet but are reservable, so they get their own row.
  const comingSoon = titles.filter(isOnOrder);
  const newest = [...titles.filter((t) => !isOnOrder(t) && !t.pinned)]
    .sort(
      (a, b) =>
        b.firstSeen.localeCompare(a.firstSeen) ||
        (b.releaseYear ?? b.year ?? 0) - (a.releaseYear ?? a.year ?? 0),
    );
  shelves.push({
    id: "new",
    title: "New to the library",
    href: browseHref(kind, { sort: "new" }),
    items: newest,
  });

  if (comingSoon.length >= 6)
    shelves.push({
      id: "coming-soon",
      title: "Coming soon: reserve now",
      items: shuffleStable(comingSoon, seed),
    });

  const onShelf = shuffleStable(
    titles.filter((t) => t.available > 0 && hasArt(t)),
    seed,
  );
  if (onShelf.length)
    shelves.push({
      id: "available",
      title: "On the shelf right now",
      href: browseHref(kind, { available: "1" }),
      items: onShelf,
    });

  if (kind === "film") {
    const acclaimed = titles.filter(
      (t) => (t.extras?.rottenTomatoesScore ?? 0) >= 90 && hasArt(t),
    );
    if (acclaimed.length >= 8)
      shelves.push({
        id: "acclaimed",
        title: "Critics loved these",
        href: browseHref(kind, { sort: "critics" }),
        items: onShelfFirst(shuffleStable(acclaimed, seed)),
      });
  }

  const family = titles.filter((t) => t.audience === "children");
  if (family.length >= 8)
    shelves.push({
      id: "family",
      title: kind === "film" ? "For the kids" : "For younger readers",
      href: browseHref(kind, { audience: "children" }),
      items: onShelfFirst(shuffleStable(family, seed)),
    });

  for (const g of getGenres(kind).slice(0, 12)) {
    if (g.count < 8) continue;
    shelves.push({
      id: `genre-${g.name}`,
      title: g.name,
      href: browseHref(kind, { genre: g.name }),
      items: onShelfFirst(
        shuffleStable(
          titles.filter((t) => t.genres.includes(g.name)),
          seed,
        ),
      ),
    });
  }

  // Spotlight the person with the most titles (a director for films, an author otherwise).
  const people = new Map<string, number>();
  for (const t of titles)
    for (const p of creatorsOf(t)) people.set(p, (people.get(p) ?? 0) + 1);
  const top = [...people.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 6) {
    shelves.splice(3, 0, {
      id: "person",
      title: kind === "film" ? `Directed by ${top[0]}` : `More from ${top[0]}`,
      href: `/search/${modeByKind(kind).slug}?q=${encodeURIComponent(top[0])}`,
      items: onShelfFirst(titles.filter((t) => creatorsOf(t).includes(top[0]))),
    });
  }

  if (kind === "film") {
    const classics = titles.filter((t) => t.year && t.year < 1980);
    if (classics.length >= 8)
      shelves.push({
        id: "classics",
        title: "Classics (before 1980)",
        href: browseHref(kind, { decade: "classic" }),
        items: onShelfFirst(shuffleStable(classics, seed)),
      });
  }

  return shelves
    .filter((s) => s.items.length > 0)
    .map((s) => ({ ...s, items: pick(s.items) }));
}

/**
 * Candidates for the home carousel, stable for a catalog build, general picks first. Includes
 * children's, e-item and print/CD extras so Kids and format filters still have something to
 * feature after client-side filtering (the carousel shows the first n that pass).
 */
export function getFeaturedCandidates(kind: Kind, n = FEATURED_COUNT): Title[] {
  const catalog = catalogs[kind];
  const seed = catalog.generatedAt;
  const good = catalog.titles.filter(
    (t) => hasArt(t) && t.summary && t.summary.length > 120 && (t.available > 0 || isEItem(t)),
  );
  const recent = (list: Title[]) =>
    [...list].sort((a, b) => (b.releaseYear ?? b.year ?? 0) - (a.releaseYear ?? a.year ?? 0)).slice(0, 30);
  const general = shuffleStable(recent(good), seed).slice(0, n);
  const kids = shuffleStable(recent(good.filter((t) => t.audience === "children")), seed).slice(0, Math.ceil(n / 2));
  // Same for the eBooks/eAudiobooks and print/CD format choices.
  const byFormat = [isEItem, (t: Title) => !isEItem(t)].map((f) =>
    shuffleStable(recent(good.filter(f)), seed).slice(0, Math.ceil(n / 2)),
  );
  const seen = new Set<string>();
  return [...general, ...kids, ...byFormat.flat()].filter((t) => !seen.has(t.irn) && seen.add(t.irn));
}

// Each scan is O(catalogue), and the build renders every title twice (page + modal).
const similarMemo = new Map<string, Title[]>();

export function similarTitles(t: Title, n = 12): Title[] {
  const key = `${t.kind}:${t.irn}:${n}`;
  let hit = similarMemo.get(key);
  if (!hit) similarMemo.set(key, (hit = scoreSimilar(t, n)));
  return hit;
}

function scoreSimilar(t: Title, n: number): Title[] {
  const mine = creatorsOf(t);
  return catalogs[t.kind].titles
    .filter((o) => o.irn !== t.irn)
    .map((o) => {
      let s = 0;
      for (const g of o.genres) if (t.genres.includes(g)) s += 2;
      for (const d of creatorsOf(o)) if (mine.includes(d)) s += 4;
      for (const c of o.cast) if (t.cast.includes(c)) s += 1;
      if (o.audience && o.audience === t.audience) s += 1;
      return { o, s, h: hash(t.irn + o.irn) };
    })
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || a.h - b.h)
    .slice(0, n)
    .map((x) => x.o);
}
