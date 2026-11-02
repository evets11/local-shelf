import type { Kind, Title } from "./types";
import { isEItem } from "./format";

/** Normalise "localshelf.uk" or "https://localshelf.uk/" to an origin; "" means unset. */
function origin(v: string | undefined): string | null {
  const t = v?.trim();
  if (!t) return null;
  return new URL(/^https?:\/\//.test(t) ? t : `https://${t}`).origin;
}

/** The live site. */
export const PRODUCTION_URL = "https://localshelf.uk";

/**
 * Public origin for canonical URLs, sitemap and social cards: NEXT_PUBLIC_SITE_URL if set
 * (e.g. a preview domain), else the live site in production builds, else localhost.
 */
export const SITE_URL =
  origin(process.env.NEXT_PUBLIC_SITE_URL) ??
  (process.env.NODE_ENV === "production" ? PRODUCTION_URL : "http://localhost:3100");

export const SITE_NAME = "Local Shelf";
export const SITE_DESCRIPTION =
  "Browse the films, TV, DVDs, books and audiobooks you can borrow from Brighton & Hove libraries, see what's on the shelf at your local library right now, and reserve it. A free, unofficial community project.";

export const DEFAULT_TITLE = `${SITE_NAME}: Brighton & Hove library films, books and audiobooks`;

/** Open Graph fields every page shares. Pages spread this: Next replaces openGraph wholesale. */
export const OG_BASE = {
  siteName: SITE_NAME,
  locale: "en_GB",
  type: "website",
  // The branded card from app/opengraph-image.tsx (setting openGraph drops the automatic one).
  images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Local Shelf: Brighton & Hove Libraries, browsed better" }],
};

/** Each collection's home heading, also its page title. */
export const COLLECTION_TITLES: Record<Kind, string> = {
  film: "Films and TV to borrow from Brighton & Hove Libraries",
  book: "Books to borrow from Brighton & Hove Libraries",
  audiobook: "Audiobooks and eAudiobooks from Brighton & Hove Libraries",
};

export const absolute = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const FORMAT_WORDS: Partial<Record<Title["format"], string>> = {
  DVD: "on DVD",
  "Blu-ray": "on Blu-ray",
  "DVD box set": "DVD box set",
  "Audiobook CD": "audiobook on CD",
  eAudiobook: "eAudiobook",
};

/** "Coraline (2009) on DVD" / "Wolf Hall by Hilary Mantel" for titles and link text. */
export function titleHeadline(t: Title): string {
  const year = t.year ? ` (${t.year})` : "";
  if (t.kind === "film") return `${t.title}${year} ${FORMAT_WORDS[t.format] ?? "on DVD"}`;
  const by = t.authors?.length ? ` by ${t.authors.slice(0, 2).join(" and ")}` : "";
  const fmt = t.kind === "audiobook" ? `, ${FORMAT_WORDS[t.format] ?? "audiobook"}` : "";
  return `${t.title}${by}${fmt}`;
}

/** Meta description: availability first (it's what people search for), then the blurb. */
export function titleDescription(t: Title, summary: string | null): string {
  const where =
    isEItem(t)
      ? "Borrow free with a Brighton & Hove library card on BorrowBox or Libby."
      : t.available > 0
        ? `On the shelf at ${t.availableAt.length > 1 ? `${t.availableAt.length} Brighton & Hove libraries` : (t.availableAt[0] ?? "Brighton & Hove Libraries")}.`
        : "Reserve it from Brighton & Hove Libraries.";
  const text = `${where} ${summary ?? ""}`.trim();
  return text.length > 158 ? `${text.slice(0, 155).replace(/\s+\S*$/, "")}…` : text;
}

const person = (name: string) => ({ "@type": "Person", name });

/** Movie / TVSeries / Book structured data for a title page. */
export function titleJsonLd(t: Title, image: string | null, summary: string | null) {
  const url = absolute(`/title/${t.irn}`);
  const sameAs = [
    t.extras?.imdbId && `https://www.imdb.com/title/${t.extras.imdbId}/`,
    t.extras?.wikipediaUrl,
    t.extras?.wikidataId && `https://www.wikidata.org/wiki/${t.extras.wikidataId}`,
  ].filter(Boolean);
  const common = {
    "@context": "https://schema.org",
    name: t.title,
    url,
    ...(image && { image }),
    ...(summary && { description: summary }),
    ...(t.year && { datePublished: String(t.year) }),
    ...(t.genres.length && { genre: t.genres }),
    ...(t.languages.length && { inLanguage: t.languages }),
    ...(sameAs.length && { sameAs }),
  };
  if (t.kind === "film") {
    return {
      ...common,
      "@type": t.genres.includes("TV") ? "TVSeries" : "Movie",
      ...(t.directors.length && { director: t.directors.map(person) }),
      ...(t.cast.length && { actor: t.cast.slice(0, 10).map(person) }),
      ...(t.certificate && { contentRating: `BBFC ${t.certificate}` }),
      ...(t.runtimeMins && { duration: `PT${t.runtimeMins}M` }),
    };
  }
  return {
    ...common,
    "@type": t.kind === "audiobook" ? ["Book", "Audiobook"] : "Book",
    ...(t.authors?.length && { author: t.authors.map(person) }),
    ...(t.narrators?.length && { readBy: t.narrators.map(person) }),
    ...(t.isbn && { isbn: t.isbn }),
    ...(t.publisher && { publisher: { "@type": "Organization", name: t.publisher } }),
    bookFormat:
      t.kind === "audiobook"
        ? "https://schema.org/AudiobookFormat"
        : t.format === "eBook"
          ? "https://schema.org/EBook"
          : "https://schema.org/Paperback",
  };
}

/** Home > Collection > Title, for search result breadcrumbs. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absolute(it.path),
    })),
  };
}
