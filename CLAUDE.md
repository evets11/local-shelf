@AGENTS.md

# Local Shelf: guide for AI agents

Local Shelf (https://localshelf.uk) is an unofficial community site for browsing what Brighton & Hove Libraries lend: films/TV on DVD, books and audiobooks. Next.js 16 App Router, React 19, Tailwind v4, TypeScript. Data comes from the library's Spydus catalogue via a nightly sync. Read [docs/README.md](docs/README.md) for the full map; this file is the short list of things that bite.

## Before you change anything

- **Next.js 16 differs from your training data.** Read the relevant guide in `node_modules/next/dist/docs/` first (see AGENTS.md above). Cache Components is on (`cacheComponents: true`); `params`/`searchParams` are Promises; route types come from `next typegen` (`PageProps<"/route">`).
- **Be polite to the library's server.** It's a public council service. Only add Spydus requests on robots.txt-allowed paths, keep live requests cached and rate-limited, and never widen what the sync crawls without asking. Details: [docs/data-and-sync.md](docs/data-and-sync.md).
- **Don't commit, push, deploy, buy domains or change third-party accounts unless the user asks.**

## Commands

```bash
npm run dev            # dev server
npm test               # vitest: parser/enrich/client tests against saved HTML fixtures
npm run lint           # eslint
npm run typecheck      # generate route types, then tsc (scripts/ and tests/ included)
npm run build          # production build (about 10,000 static pages, ~1 min)
npm run sync -- --offline   # re-parse cached catalogue HTML without touching the library
npm run prizes -- --offline # re-parse cached prize lists and searches (no requests); see docs/data-and-sync.md
```

Run `npm run typecheck && npm run lint && npm test` before saying you're done.

**Rebuild footgun:** stop any running `next start` and `rm -rf .next` before `npm run build`. Building over a live server half-loads pages or fails with `ENOTEMPTY`. Routine: `lsof -ti tcp:3100 | xargs kill; rm -rf .next && npm run build && npx next start -p 3100`.

## Conventions

- **Copy and comments:** plain, natural British English. No em dashes in UI text or docs. Comments explain how non-obvious code works now, briefly; never "used to" history.
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), short subject, body only when the why isn't obvious.
- **Client vs server:** `src/lib/catalog.ts` is server-only (it imports the catalogue JSON). Client components get slim `CardTitle`s from `src/lib/card.ts`. Keep `src/lib/format.ts`, `modes.ts`, `prefs*.ts` and `spydus/urls.ts` client-safe.
- **Preferences** live in localStorage (`src/lib/prefs.ts`) and are mirrored onto `<html data-*>` before first paint by `PREFS_SCRIPT` (`src/lib/prefs-script.ts`), so CSS can react without a flash. Storage keys are prefixed `shelflife:` (the app's old name); don't rename them, it would wipe users' settings.
- **Sheets:** titles (`/title/[irn]`) and full-catalogue items (`/item?...`) open as intercepted modal routes (`src/app/@modal`), using `Modal.tsx`. Its close/focus-return/swipe logic is subtle; re-test Escape, X, backdrop click, browser Back, swipe-down and keyboard focus return after any change.
- **Accessibility is a requirement:** keyboard reachable, visible focus, labelled controls, reduced motion respected, 16px inputs on touch (iOS zoom).
- **Site name and URL** come from `src/lib/site.ts` (`SITE_NAME`, `SITE_URL`). Library URLs come from `LIBRARY_LINKS` in `src/lib/spydus/urls.ts`. Don't hardcode either.

## QA

The user likes to watch browser QA live in their Chrome. Check changes in a real browser, including phone width, light and dark themes, and the Kids profile, not just tests. The iOS simulator is driven headlessly with `xcrun simctl openurl booted <url>` and `xcrun simctl io booted screenshot <file>` (Xcode 27 replaced Simulator.app with DeviceHub).

## Where things are

| Topic                                                 | Doc                                            |
| ----------------------------------------------------- | ---------------------------------------------- |
| How the app is put together                           | [docs/architecture.md](docs/architecture.md)   |
| Spydus, the sync, enrichment, robots rules            | [docs/data-and-sync.md](docs/data-and-sync.md) |
| Setup, env vars, testing, QA                          | [docs/development.md](docs/development.md)     |
| Vercel, domain, DNS, search console                   | [docs/deployment.md](docs/deployment.md)       |
| Installable app, service worker, iOS                  | [docs/pwa.md](docs/pwa.md)                     |
| Metadata, sitemap, structured data, llms.txt          | [docs/seo.md](docs/seo.md)                     |
| Themes, Kids, preferences, accessibility, UI patterns | [docs/ui.md](docs/ui.md)                       |
| Open decisions and known gaps                         | [docs/decisions.md](docs/decisions.md)         |
