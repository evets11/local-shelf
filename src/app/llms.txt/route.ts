import { getCatalog } from "@/lib/catalog";
import { MODES } from "@/lib/modes";
import { absolute } from "@/lib/site";
import { LIBRARY_LINKS } from "@/lib/spydus/urls";

/** llms.txt (https://llmstxt.org): a plain guide to the site for AI assistants. Built with the catalogue. */
export function GET() {
  const counts = Object.fromEntries(MODES.map((m) => [m.kind, getCatalog(m.kind).titles.length]));
  const updated = getCatalog("film").generatedAt.slice(0, 10);
  const body = `# Local Shelf

> Local Shelf is a free, unofficial community website for browsing what Brighton & Hove Libraries (East Sussex, UK) lend: films and TV on DVD and Blu-ray, books, audiobooks on CD and eAudiobooks. It shows which library branches have a copy on the shelf and links to the library's own catalogue to reserve. It is not run by Brighton & Hove City Council.

Key facts:

- Coverage: all ${counts.film} DVD/Blu-ray titles; the ${counts.book} newest books and ${counts.audiobook} newest audiobooks. Searching books and audiobooks on the site queries the library's full catalogue live.
- Availability on listings is a nightly snapshot (last updated ${updated}). Each title page checks the library's shelves live.
- Reserving, borrowing, renewing and fees are handled by Brighton & Hove Libraries, not by Local Shelf. eAudiobooks are borrowed free with a library card on BorrowBox or Libby.
- Branches include Jubilee Library (the central library in Brighton), Hove Library and community libraries across the city.

## Collections

${MODES.map((m) => `- [${m.label}](${absolute(m.home)}): new arrivals, critics' picks and what's on the shelf, with links to each title`).join("\n")}

## Title pages

- Every title has a page at ${absolute("/title/{id}")} with format, availability by library, a link to reserve it on the library catalogue and, for films, IMDb, Rotten Tomatoes and trailer links where known.
- [The sitemap](${absolute("/sitemap.xml")}) lists every title page; each one is plain server-rendered HTML with schema.org Movie or Book data.
- Browse and search pages filter in the browser with JavaScript, so fetch title pages instead.

## About

- [About Local Shelf](${absolute("/about")}): how to borrow, accessibility settings and where the data comes from
- [Brighton & Hove Libraries catalogue](${LIBRARY_LINKS.catalogue}): the official catalogue and library account
- [Brighton & Hove Libraries](${LIBRARY_LINKS.home}): opening times, fees, joining and everything else about the library

## Optional

- [Support Local Shelf](${absolute("/support")})
`;
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
