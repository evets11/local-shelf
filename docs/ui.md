# UI and UX

The aim is a streaming-app feel that's useful rather than salesy: big covers, simple controls, sensible defaults, everything configurable in Settings, and no dark patterns (no autoplay, no nagging, no tracking cookies; page views are counted anonymously with Vercel Web Analytics).

## Layout

- **Desktop header:** logo, collection switch (Films & TV / Books / Audiobooks), Browse, My List, an always-open search box, Everyone/Kids, My library, Donate, theme toggle, Settings.
- **Between 1024px and 1280px wide:** Everyone/Kids and My library move to a second header row.
- **Phones (below 1024px):** an iOS-style layout.
  - **Header:** a large collection title that opens a menu to switch collection, a profile button, a search field, and filter chips (library, "On the shelf", Kids). Pages outside a collection get a compact logo row instead.
  - **Profile sheet** (`ProfileSheet.tsx`, a bottom-sheet `<dialog>`): Everyone/Kids, my library, "on the shelf only", theme, and links to Settings, About and Donate. Opened with `openProfileSheet()`.
  - **Featured picks:** swipeable cards with details beside the cover, never over the art.
  - **Tab bar:** a slim floating bar with Home, Browse, My List and Settings.
- **Audiobooks** get a sub-bar to show All, eAudiobooks or CDs.
- Switching collection keeps you in the same section (Browse stays Browse, search keeps its text).
- **First visit:** a dismissible welcome card under the header explains what the site is (`Welcome.tsx`). It's an inset card in page colours so it stands apart from the featured hero. Dismissing it returns you to the top of the page. Hidden before paint once dismissed; never shown in the installed app.

## Preferences (`src/lib/prefs.ts`)

Saved per device in localStorage under `shelflife:prefs` (an old name; keep it so settings survive). Nothing leaves the browser.

| Pref | Values | Effect |
| --- | --- | --- |
| `branch` | a library or "" | "My library": filters shelves and badges to that branch |
| `onShelfOnly` | boolean | hide titles with no copy on the shelf (at your library if set) |
| `profile` | `everyone`, `kids` | Kids shows only children's titles and switches to a yellow/purple palette with a banner |
| `audioFormat` | `all`, `eaudiobook`, `cd` | audiobook format filter |
| `bookFormat` | `all`, `ebook`, `print` | book format filter (print includes large print) |
| `theme` | `dark` (default), `light` | colour theme |
| `cover` | `compact`, `standard` (default), `big` | card size (`--card-w`) |
| `textSize`, `contrast`, `font`, `motion` | | larger text, high contrast, Atkinson Hyperlegible, reduced motion |

`PREFS_SCRIPT` (inline in `<head>`) copies display prefs to `<html data-*>` before paint, sets `data-pref-filtering` when saved prefs would filter content, `data-welcomed`, `data-standalone`, and the theme colour. Browse and search filters default to the saved prefs, and a URL param overrides them for that view ("Reset to my settings" clears it).

## Colours and tokens (`src/app/globals.css`)

Colours are CSS variables on `<html>` (Tailwind v4 `@theme`): `--color-paper`, `--color-ink`, `--color-sea` (accent), `--color-coral`, `--color-hero` and so on.

- **Accent:** Brighton & Hove Albion blue: `#0057b8` in light, a brighter `#3d8ae8` in dark with dark text on buttons for contrast. Colour only, no club branding.
- **Variants:** light, Kids (yellow accent), high contrast (dark and light).
- **Status vs controls:** availability uses `--color-shelf` (green): the "On the shelf" badge, shelf pills, live dots. The accent is for controls and "yours" markers (buttons, active filters, the "Your library" chip). Coral (the Donate heart) is never used for status.
- **Badges:** "On the shelf" (green), "Borrow online" (violet, e-items), "On order", "Not on shelf". Rotten Tomatoes score top right.

## Patterns

- **Sheets** for titles and catalogue results (see [Architecture](architecture.md#sheets-intercepting-routes)). Close with X, Escape, backdrop, Back or swipe down; focus and scroll position return. On one-column layouts "Where to find it" comes before the synopsis.
- **Trailers** open in their own dialog above the sheet (YouTube no-cookie embed) and stop when closed, however that happens.
- **Skeletons** (`Skeleton.tsx`) for anything loading: catalogue search results, item sheets, shelf-check pills, My List, covers. They shimmer unless reduced motion is on.
- **Live shelf checks** show last night's data immediately, with placeholders where the live answer will go.
- **The featured carousel** is manual only (no autoplay).
- **The install sheet and offline pill** sit above the tab bar (see [PWA](pwa.md)).
- **Donate:** a quiet heart in the header goes to `/support`, which explains where money goes and embeds Ko-fi's form. No pop-ups.

## Accessibility

- Everything works by keyboard; `:focus-visible` gets a 2px accent outline. Text fields show focus with their own border/ring instead.
- Skip link, landmarks, one `<h1>` per page, labelled icon buttons, `aria-current` on active nav, `role="status"` for live messages.
- Reduced motion: the in-app setting and the OS setting both turn off animations and transitions.
- Native `<dialog>` with `showModal()` for sheets and trailers (focus trapping, Escape, top layer). The page behind doesn't scroll (`html:has(dialog[open])`).
- On touch devices inputs are at least 16px so iOS doesn't zoom.

## Copy

Plain, friendly British English. No em dashes. Say what something does, not marketing ("On the shelf at Jubilee Library", not "Grab it now!"). Be clear that Local Shelf is unofficial and that reserving and borrowing happen on the library's site.
