# SEO and discoverability

Goal: people searching for things like "Brighton library DVDs" or a specific film plus "library" find Local Shelf, and AI assistants describe it accurately.

## Where it lives

| Piece | Where |
| --- | --- |
| Site name, URL, default title/description, shared Open Graph fields | `src/lib/site.ts` |
| Site-wide metadata (`metadataBase`, title template, keywords, Twitter card) | `src/app/layout.tsx` |
| Per-page titles, descriptions, canonicals, Open Graph | each `page.tsx` (`metadata` or `generateMetadata`) |
| Title page headline/description/JSON-LD | `titleHeadline`, `titleDescription`, `titleJsonLd`, `breadcrumbJsonLd` in `site.ts` |
| Home page JSON-LD (`WebSite` + `SearchAction`, about the library) | `src/app/page.tsx` |
| Default social image | `src/app/opengraph-image.tsx` |
| Sitemap (every collection, browse page and title) | `src/app/sitemap.ts` |
| robots.txt (all crawlers welcome, `/api/` disallowed) | `src/app/robots.ts` |
| llms.txt (plain guide for AI assistants) | `src/app/llms.txt/route.ts` |

## Rules

- **Canonical URLs and Open Graph are per page.** Next replaces `openGraph` wholesale, so pages spread `OG_BASE` (site name, locale, type, default image) and set their own `url`, `title` and `description`. Don't put a canonical or `og:url` in the layout: every page would inherit it and claim to be the home page.
- **Noindex:** search results (`/search/*`), My List, Settings and catalogue items (`/item`) are `noindex, follow`.
- **Title pages:** the title reads like "Coraline (2009) on DVD" or "Wolf Hall by Hilary Mantel"; the description leads with availability ("On the shelf at 2 Brighton & Hove libraries…"). JSON-LD is `Movie`/`TVSeries`/`Book`/`Audiobook` plus a breadcrumb.
- **Images:** only TMDB posters are used as share images. The library's cover service can return a blank image and its URLs carry the library's licence key, so otherwise the branded default card is used.
- **Headings:** every page has one `<h1>`. Collection homes use a visually hidden one (the carousel leads visually); title pages use `<h1>` on the full page and `<h2>` in sheets.
- **Copy:** keep "Brighton & Hove" and "library" in titles and headings naturally; don't stuff keywords.
- The sitemap's `lastModified` is the catalogue's last sync, since availability (and so descriptions) can change nightly.

## Checking

```bash
curl -s localhost:3100/title/<irn> | grep -o '<title>[^<]*</title>\|<link rel="canonical"[^>]*>\|<meta property="og:[a-z:]*"[^>]*>'
curl -s localhost:3100/sitemap.xml | grep -c '<url>'
curl -s localhost:3100/llms.txt
```

After launch, use Google Search Console, the Rich Results Test and a link preview in a chat app.
