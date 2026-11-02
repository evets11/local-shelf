# Local Shelf

**https://localshelf.uk** · A streaming-style way to browse the films, TV, books and audiobooks you can borrow from Brighton & Hove Libraries, see what's on the shelf at your local library right now, and reserve it.

It's an unofficial, not-for-profit community project and isn't affiliated with Brighton & Hove City Council. Loans, reservations and fees all happen on the library's own site.

## Features

- **Three collections:** every DVD/Blu-ray, plus the newest books and audiobooks (CDs and eAudiobooks). Book and audiobook searches also query the library's full catalogue live.
- **Browse, search, recommend:** home rows by genre, "On the shelf right now", "Coming soon: reserve now", "Critics loved these", "More like this" and "Because you saved…", with instant search and filters for library, genre, decade, language, format and certificate.
- **Live shelf checks:** each title shows which branch has a copy right now.
- **Films:** IMDb, Rotten Tomatoes and Metacritic from Wikidata, and embedded trailers.
- **Made for everyone:** an Everyone/Kids profile, "My library" and "on the shelf only" filters, dark or light theme, cover size, larger text, high contrast, a readable typeface and reduced motion. No accounts or cookies: settings and My List are saved on your device and nothing is stored on our server. Visits are counted anonymously with Vercel Web Analytics.
- **Installable app:** add it to your home screen on iPhone or Android; pages you've opened work offline.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test && npm run lint && npm run typecheck
```

The catalogue snapshot is in `data/`, so no sync is needed to run it. See [Development](docs/development.md) for syncing, environment variables and QA.

## Documentation

Everything is in [`docs/`](docs/README.md):

- [Architecture](docs/architecture.md): routes, data flow, key modules
- [Data and sync](docs/data-and-sync.md): the library catalogue, robots.txt rules, the nightly sync, enrichment, live lookups
- [Development](docs/development.md): setup, env vars, tests, local production builds, QA checklist
- [Deployment](docs/deployment.md): Vercel, the localshelf.uk domain, search consoles, donations
- [PWA](docs/pwa.md): installable app, service worker, iOS polish
- [SEO](docs/seo.md): metadata, sitemap, structured data, llms.txt
- [UI](docs/ui.md): preferences, themes, Kids profile, patterns, accessibility, copy style
- [Decisions](docs/decisions.md): what's been decided and what's still open

AI coding agents: start with [CLAUDE.md](CLAUDE.md).

## Being a good neighbour

The catalogue is a public council service. The nightly sync makes at most two requests at a time with a delay, identifies itself in its User-Agent, and avoids paths disallowed by `robots.txt` apart from one search per list (seven a run, occasionally a few more if a result set expires). Live searches are relayed only when someone searches, cached for 10 minutes and capped. If the library would rather we did this differently, we'll change it. Details in [Data and sync](docs/data-and-sync.md).

## Support

Local Shelf is free. If it helps you, you can [chip in towards running costs](https://localshelf.uk/support).

## Running your own copy

You're welcome to, for another library service or to try changes. Please:

- **Keep the politeness limits.** The rate limits, caches and request pacing in `src/lib/spydus/client.ts` and `scripts/sync.ts` exist because each copy makes its own requests to a council service.
- **Identify yourself.** Requests carry `CONTACT_URL` (on Vercel it defaults to your own repo), so a library can reach you, not us.
- **Use your own name and domain.** "Local Shelf" and localshelf.uk belong to this project.

## Licence

[GNU Affero General Public License v3.0 or later](LICENSE). In short: use it, change it and share it, but if you run a modified copy as a public website, you must make your source code available to its users under the same licence.
