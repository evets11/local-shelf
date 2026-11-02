# Architecture

Local Shelf is a Next.js 16 App Router site. Almost everything is static: the catalogue is JSON in `data/`. Collection and browse pages, plus the newest 100 titles per collection (`getPrerenderedTitles`), are prerendered at build time. Every other title page renders on its first visit (`instant = false`, so it renders in full rather than via a generic shell) and is then cached. Prerendering all ~5,000 titles twice (page and sheet) made each deploy about 2.6 GB, past Vercel Hobby's 10 GB storage after a few deploys; now it's about 300 MB. A few small API routes do live lookups against the library.

```
Spydus OPAC (brighton-hove.spydus.co.uk)
   │  nightly GitHub Action: npm run sync, npm run enrich
   ▼
data/catalog-{films,books,audiobooks}.json + data/film-extras.json
   │  imported at build time by src/lib/catalog.ts (server only)
   ▼
static pages ──► browser
                  ├─ /api/availability/[irn]    live shelf check for a catalogue title
                  ├─ /api/library/search         live full-catalogue search (books/audiobooks)
                  ├─ /api/library/record         live record + shelves for a search hit
                  ├─ /api/cards?ids=             card data for My List
                  └─ /api/recommend              "Because you saved…" row
```

## Routes (`src/app`)

| Route | What it is |
| --- | --- |
| `/`, `/books`, `/audiobooks` | Collection homes: featured carousel and shelves (`HomeView`) |
| `/browse/[mode]` | Every title in a collection with filters and sort (`Explorer`, client-side) |
| `/search/[mode]` | Same explorer with a query; books/audiobooks also show live whole-catalogue results (`LibraryResults`) |
| `/title/[irn]` | Title page (`TitleDetail`). Also intercepted as a sheet by `@modal/(.)title/[irn]` |
| `/item?irn&set&pos&kind&q` | A live whole-catalogue result (`ExternalItem`). Also intercepted as a sheet by `@modal/(.)item` |
| `/my-list` | Saved titles (localStorage), cards from `/api/cards` |
| `/settings`, `/about`, `/support` | Preferences, about/fees/accessibility, donations (Ko-fi embed) |
| `/manifest.webmanifest`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/opengraph-image` | Generated metadata routes, see [SEO](seo.md) and [PWA](pwa.md) |

Modes (films, books, audiobooks) are defined once in `src/lib/modes.ts`. `/browse` and `/search` redirect to `/browse/films` and `/search/films` (`next.config.ts`).

### Sheets (intercepting routes)

Clicking a title or a catalogue result keeps you on the page and opens it in a sheet. `src/app/@modal` is a parallel route slot rendered in the root layout:

- `(.)title/[irn]` and `(.)item` render the detail inside `Modal`.
- `[...catchAll]` and `default.tsx` render nothing, which closes the sheet when you navigate elsewhere.
- Opening the URL directly (or refreshing) renders the full page instead, with a visible "‹ Back" button.

`src/components/Modal.tsx` wraps a native `<dialog>` with `showModal()`. It handles close-to-navigate-back, a stale-close guard, focus return to the card that opened it (`src/lib/last-activated.ts`), and swipe-down-to-close on phones. Next keeps hidden routes mounted, so effect cleanups close the dialog; see the comments there before changing it.

## Key modules

- `src/lib/types.ts`: the data contract (`Title`, `Holding`, `Catalog`, `FilmExtras`).
- `src/lib/catalog.ts` (server only): loads the catalogue JSON, merges film extras, builds home shelves, featured picks and "More like this".
- `src/lib/card.ts`: slim `CardTitle` / `SearchTitle` shapes sent to the client.
- `src/lib/format.ts` (client safe): poster URLs, fees, availability labels, e-item checks, text tidying.
- `src/lib/prefs.ts` + `prefs-script.ts`: per-device preferences and the pre-paint script. See [UI](ui.md).
- `src/lib/site.ts`: site name, URL, page title/description helpers and JSON-LD builders. See [SEO](seo.md).
- `src/lib/pwa.ts`: service worker registration, install prompt state, external links in the installed app. See [PWA](pwa.md).
- `src/lib/spydus/*`: talking to the library. `urls.ts` builds robots-safe URLs, `parse.ts` turns HTML into data, `build.ts` turns parsed records into `Title`s, `client.ts` does fetching, caching and rate limits. See [Data and sync](data-and-sync.md).
- `src/lib/enrich/*`: Wikidata/OMDb matching for films (IMDb, Rotten Tomatoes, trailers).
- `src/lib/concurrency.ts`: `Limiter` (slot semaphore) and `pool`, shared by the client and scripts.

## Rendering notes

- **Cache Components** is on. Static data is imported at build time. Shelf checks (`/api/availability`) use `'use cache'` with `cacheLife`; library search and record lookups use small in-memory TTL caches in `client.ts` plus CDN `Cache-Control` headers.
- Pages that depend on per-device preferences render unfiltered on the server. Regions marked `data-pref-filtered` stay hidden until hydration when saved prefs would filter them, so the Kids profile never flashes adult covers.
- Client components that read the URL (`useSearchParams`) sit inside `Suspense`.
