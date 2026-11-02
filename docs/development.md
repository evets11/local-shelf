# Development

## Setup

Needs Node 24 (what CI uses) and npm.

```bash
npm install
cp .env.example .env.local   # all optional, see below
npm run dev                  # http://localhost:3000
```

The catalogue JSON is in git, so you don't need to sync to run the site. To refresh it:

```bash
npm run sync -- --limit 30   # a quick sample per list (written to *.sample.json)
npm run sync                 # everything: first run ~1.5 hours, later runs ~1 hour
npm run sync -- --offline    # re-parse cached HTML, no requests
npm run enrich               # film extras from Wikidata (and OMDb if keyed)
```

Please read [Data and sync](data-and-sync.md) before running a full sync: it makes real requests to a council service.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `CONTACT_URL` | sync, enrich, live lookups | how the library and Wikidata can reach whoever runs this (sent in the User-Agent). Defaults to the deployed GitHub repo; never use a personal email |
| `TMDB_API_KEY` or `TMDB_READ_TOKEN` | sync | optional: posters, backdrops and trailers for most films (v3 key or v4 read token) |
| `OMDB_API_KEY` | enrich | optional: IMDb ratings |
| `NEXT_PUBLIC_SOURCE_URL` | build | optional: the footer's "Source code" link (defaults to the GitHub repo Vercel deploys from) |
| `NEXT_PUBLIC_SITE_URL` | build | optional override for the public URL. Production builds default to https://localshelf.uk |

## Checks

```bash
npx tsc --noEmit   # types (includes scripts/ and tests/)
npm run lint
npm test           # vitest against saved HTML fixtures in tests/fixtures
npm run build
```

Tests cover the Spydus parsers (films, books, audiobooks, holdings, audience), the live client's caching and recovery, and the Wikidata matcher. When a parsing bug turns up, save the record's HTML as a fixture and add a test.

## Running a production build locally

Always stop the server and clear `.next` before rebuilding. Building over a running `next start` serves a mix of old and new files (pages half-load) or fails with `ENOTEMPTY`:

```bash
lsof -ti tcp:3100 | xargs kill
rm -rf .next && npm run build
npx next start -p 3100
```

Hard-refresh any open tabs afterwards. The service worker only registers in production builds; to reset it, use Chrome DevTools > Application > Service workers > Unregister, or clear site data.

## QA checklist

Check changes in a real browser, not only in tests:

- Desktop and phone widths (and the iOS simulator for anything PWA or touch related, see [PWA](pwa.md)).
- Dark and light themes, the Kids profile, and a saved library with "on the shelf only".
- Keyboard: Tab through, Enter to open, Escape to close sheets, focus returns to the card.
- Sheets: X, Escape, backdrop click, browser Back and swipe-down all close; scroll position is kept.
- A books/audiobooks search that hits the whole catalogue (e.g. "hilary mantel"), then open a result.
- My List with a few saved titles, including offline (stop the server) after changing the list.

## CI and updates

- `.github/workflows/ci.yml` runs types, lint and tests on pushes to `main` (except data-only sync commits) and on pull requests. Vercel does the build.
- Dependabot (`.github/dependabot.yml`) opens one grouped npm update PR a week and monthly GitHub Actions updates. Keep TypeScript on 6.x until typescript-eslint supports 7.

## Code review

After a milestone, run a high-effort code review (`/code-review high`) and fix what it finds before calling the work done.
