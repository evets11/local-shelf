# Data and sync

All catalogue data comes from Brighton & Hove Libraries' public Spydus catalogue at https://brighton-hove.spydus.co.uk. It's a council service, so being a polite visitor is a hard requirement, not a nicety.

## The robots.txt rules (read this first)

The catalogue's robots.txt uses longest-match rules. What that means for us:

- `ENQ/OPAC/BIBENQ*` (searches) is **disallowed**, except `ENQ/OPAC/BIBENQ?SETLVL=&BRN=<brn>` (a bookmark link to one record), which is allowed.
- `PAGE`, `FULL`, `SET` and `XHLD` paths (result pages, full records, holdings) are allowed.

So:

- The **sync** makes one disallowed search per list (seven per run) to get a result set, plus at most one re-run per list if its result set expires mid-run, then only uses allowed paths.
- **Live full-catalogue search** relays a person's own search: one disallowed search per query, cached 10 minutes and capped. Junk queries (fewer than two letters or digits, or outside 3-100 characters) are rejected before reaching the library.
- Everything else uses allowed paths. Deep links to the library use BRN bookmark links.
- **Don't add new Spydus requests on disallowed paths, and don't widen crawling, without the user's agreement.** Tell the library about the project before scaling up (see [Decisions](decisions.md)).

Requests identify themselves in the User-Agent (`LocalShelf community catalogue`), with a contact URL appended: `CONTACT_URL`, else the GitHub repo Vercel deployed from (`src/lib/source.ts`). Never anyone's email.

## Spydus facts we rely on

- **IRN** is the record id in URLs; **BRN** is the bibliographic number used by bookmark links. They differ.
- A **set id** (search session) lasts at least 3 hours, and any live set id works for `XHLD` (holdings) and `FULL` (records) by IRN.
- **Holdings statuses:** "Available" is the only status meaning on the shelf ("AV item" means *not* available). Stacked statuses are joined with "; ".
- Records use MARC-8 escapes for diacritics; `parse.ts` repairs them and NFC-normalises text.
- Titles are cleaned of GMDs ("[videorecording]") and edition markers, and subtitle colons are tidied ("Memoir : a life" becomes "Memoir: a life").

## The nightly sync (`scripts/sync.ts`)

Runs one search per list, newest first, walks result pages, then fetches full records and holdings:

| Collection | Lists |
| --- | --- |
| Films | every DVD/Blu-ray (`BTYP: G`, about 1,600) |
| Audiobooks | newest 1,000 audiobook CDs + newest 500 eAudiobooks |
| Books | newest 400 junior fiction, 300 young adult, 800 adult fiction, 600 adult non-fiction print books (eBooks skipped) |

- **Incremental:** full records are fetched only for new titles, or ones whose earlier fetch failed (`--full` refetches all); holdings are refreshed every run for every physical item (eAudiobooks have none).
- **Polite:** at most two requests at a time with a delay, backing off harder after 429/5xx.
- **Resilient:** a collection that fails or looks partial keeps its previous catalogue and later collections continue. But 8 consecutive request failures abort the whole run: collections already written are kept, later ones are skipped (order: films, audiobooks, books). Catalogue files are written atomically (temp file + rename).
- Raw HTML is cached in `.cache/spydus/`, so `npm run sync -- --offline` re-parses without any requests.

Flags: `--kind film|book|audiobook` (repeatable), `--offline`, `--full`, `--no-holdings`, `--limit N` (writes `data/catalog-<kind>s.sample.json`).

### Audience (Kids profile)

`deriveAudience` in `parse.ts` decides which films count as children's. The library shelves U, PG and E films together as "DVD U/PG/E", so that shelf alone isn't enough:

1. Any copy in an adult collection, or a 12/12A/15/18 certificate: adult.
2. A children's collection, a "Children's -- …" subject, or a Family/Animation genre: children's.
3. On the U/PG/E shelf: a blurb saying "family film", "children's comedy", "animated" and so on means children's; a grown-up category ("Feature -- Drama/Classic/Foreign/Thriller…") means not; otherwise children's.

Books use the list they came from (junior lists are children's); audiobooks use the record's audience note and subjects.

## Film enrichment (`scripts/enrich.ts`)

Matches films to Wikidata for IMDb ids, Rotten Tomatoes and Metacritic scores, YouTube trailer ids and Wikipedia links, written to `data/film-extras.json`. `OMDB_API_KEY` (optional) adds IMDb ratings.

- Decisions are cached in `data/wikidata-cache.json` with a fingerprint of title, year, release year, directors and TV-ness; a film is re-matched when that changes, or (if unmatched) when its cast changes.
- Matching rules and confidence tiers are in `src/lib/enrich/match.ts`, with tests in `tests/enrich.test.ts`.
- `TMDB_API_KEY` (optional, used by the sync) adds posters, backdrops and trailers for most films.

## Live lookups (`src/lib/spydus/client.ts`)

| Endpoint | Upstream | Limits |
| --- | --- | --- |
| `/api/availability/[irn]` | XHLD (plus a BRN lookup when the shared set id expires) | catalogue IRNs only; 120/min per server; cached 5 min; a breaker stops calling for 60s after 5 upstream failures; concurrent set-id refreshes are shared |
| `/api/library/search` | one keyword search | 30/min per server; cached 10 min; own slot pool so slow searches can't starve shelf checks |
| `/api/library/record` | FULL + XHLD for a search hit | 60/min per server; cached 10 min in memory and 5 min at the CDN, not cached when live holdings failed; "not a book" remembered per IRN; an expired set recovers through the (cached) original search, only for IRNs that search returned |

`src/app/api/library/errors.ts` returns `{ error, code }` with 400/410/429/502; an unknown IRN on `/api/availability` is a plain 404 `{ error }`. Limits are per server instance, not per visitor; see [Decisions](decisions.md).

## Data files (`data/`)

| File | In git? | What |
| --- | --- | --- |
| `catalog-films.json`, `catalog-books.json`, `catalog-audiobooks.json` | yes | the catalogue, rewritten nightly |
| `film-extras.json` | yes | Wikidata/OMDb extras by IRN |
| `wikidata-cache.json`, `tmdb-cache.json` | no (Actions cache) | enrichment caches |
| `.cache/spydus/` | no (Actions cache keeps `full/`) | raw HTML |

## The sync relay (`src/app/api/relay/route.ts`)

The catalogue refuses requests from outside the UK (HTTP 405). Vercel functions run in London (`vercel.json`), so live lookups work. GitHub's runners are in the US, so the nightly sync fetches through the site's `/api/relay`:

- Off unless `SPYDUS_RELAY_TOKEN` is set on Vercel. Requests need it as a `Bearer` token (wrong or missing: 404).
- Only the sync's catalogue paths: `ENQ/OPAC/BIBENQ?…` list searches and BRN lookups, and `PAGE`/`FULL`/`XHLD` pages. Anything else: 400.
- Passes the library's status through, so the sync's pacing, retries and back-off still apply.
- The sync uses it when `SPYDUS_RELAY_URL` and `SPYDUS_RELAY_TOKEN` are set (`syncRequest` in `client.ts`). Running the sync from a UK machine needs neither.

## The GitHub Action (`.github/workflows/sync.yml`)

Nightly at 03:30 UTC (and on demand): restore caches, `npm run sync`, `npm run enrich`, save caches, commit `data/` if it changed (as `localshelf-bot`), then fail the job if either step failed. A sync or enrichment failure never blocks committing what did succeed. Secrets: `SPYDUS_RELAY_TOKEN` (required, see above), `TMDB_API_KEY`, `OMDB_API_KEY` (both optional). The relay address defaults to the Vercel URL; set the repository variable `SPYDUS_RELAY_URL` to change it (e.g. `https://localshelf.uk/api/relay`).
