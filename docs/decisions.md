# Decisions and open questions

## Decided

- **Name and domain:** "Local Shelf" at localshelf.uk, generic so other library services could join later (e.g. via subdomains). Earlier names: LibraryFlix, then Shelf Life (still visible in storage keys).
- **Static first:** the catalogue is a nightly snapshot in git; only shelf checks and whole-catalogue searches are live.
- **Books and audiobooks are a "newest N" index**, not the full catalogue, which is too big to mirror politely. Search covers the rest live.
- **No accounts, no cookies.** Preferences and My List are per device. Page views are counted anonymously with Vercel Web Analytics (cookieless, no consent banner needed).
- **Dark theme by default**, Albion blue accent, Everyone/Kids profiles (not Adults/Kids).
- **Ko-fi for donations**, embedded on our own page rather than the widget script (no third-party tracking on every page).
- **Hand-written service worker**, kept narrow (see [PWA](pwa.md)).
- **Prize lists, not bestseller charts.** UK charts have no free feed, the NYT lists are American, and Goodreads has no API and forbids scraping. So `/prizes` follows UK prizes via Wikipedia and only shows books the library holds. Finding books outside our index costs a library search each, which the user agreed to for these lists (see [Data and sync](data-and-sync.md#prize-lists)).

## Open

- **Tell the library about the project.** Ask whether they're happy with it, whether they'd offer a proper data feed, and whether they mind the seven disallowed list searches per nightly sync (occasionally a few more if a result set expires) plus live relayed searches and the weekly prize-book lookups.
- **Cover images** hotlink the library's licensed cover service (the `DBM=` key is in the URLs). Fine for now, but worth raising with the library, or replacing with Open Library covers. They're already kept out of share images.
- **Per-visitor rate limits.** The live lookup caps are per server instance and shared by all visitors. Before heavy traffic, add a per-IP limit and a shared store (e.g. Upstash) so limits hold across Vercel instances.
- **Bogus URLs return 200 on the first hit.** `/title/<unknown>` and `/browse/<unknown>` show the not-found page but with status 200 until cached (a Cache Components limitation). A `proxy.ts` check before rendering would fix it.
- **iOS installed mode** hasn't been checked end to end in a simulator (launch screen, status bar in both themes). Needs one manual "Add to Home Screen" in DeviceHub.
- **TMDB and OMDb keys** would add posters, trailers and IMDb ratings for most films.
- **Ideas:** library opening hours and branch pages, due-back dates on cards, a "recently viewed" row, sharing lists, Open Library ratings, captions and audio description info for films, a large-print filter.
