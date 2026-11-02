# Deployment

Local Shelf is built for Vercel and served at https://localshelf.uk (registered with Namecheap).

## First deploy

1. Push the repo to GitHub.
2. In Vercel, **Add New > Project**, import the repo. The defaults work (framework Next.js, `npm run build`). No environment variables are required: `CONTACT_URL` (sent to the library) defaults to the GitHub repo Vercel deploys from (`src/lib/source.ts`).
3. In the GitHub repo settings, optionally add the Actions secrets `TMDB_API_KEY` and `OMDB_API_KEY`. The nightly sync commits refreshed `data/` files, which triggers a Vercel redeploy.

The free Hobby plan is enough for the traffic and build size (about 10,000 static pages, ~1 minute). Check Vercel's terms about donations if the site starts taking significant money.

## Sync relay token

The nightly sync reaches the library through the site (see [Data and sync](data-and-sync.md#the-sync-relay-srcappapirelayroutets)). Generate a long random token (`openssl rand -hex 32`) and set it as:

- Vercel: Settings > Environment Variables > `SPYDUS_RELAY_TOKEN` (Production), then redeploy.
- GitHub: Settings > Secrets and variables > Actions > New repository secret > `SPYDUS_RELAY_TOKEN`.

The sync uses `https://localshelf.uk/api/relay` by default (Actions variable `SPYDUS_RELAY_URL` overrides it).

## Function region

`vercel.json` runs functions in London (`lhr1`), next to the library's catalogue. The catalogue refused requests from Vercel's default US region with HTTP 405, and London is faster anyway.

## Connecting localshelf.uk

1. Vercel project > **Settings > Domains** > add `localshelf.uk` (connected to Production, no redirect) and `www.localshelf.uk` (**redirect** to `localshelf.uk`, 308). Not the other way round: canonical URLs, the sitemap and social cards all use the apex.
2. Vercel shows the DNS records it needs (an `A` record for the apex and a `CNAME` for `www`). In Namecheap > Domain List > Manage > **Advanced DNS**, delete the parking records and add those exactly.
3. Wait for Vercel to show both as valid (minutes to a few hours). It issues HTTPS automatically.

Production builds already use `https://localshelf.uk` for canonical URLs, the sitemap and social cards (`src/lib/site.ts`). Set `NEXT_PUBLIC_SITE_URL` only to override that, for example on a separate staging domain.

## After it's live

- **Google Search Console:** add the domain property `localshelf.uk` (verify with the DNS TXT record in Namecheap), then submit `https://localshelf.uk/sitemap.xml`.
- **Bing Webmaster Tools:** import from Search Console, or add the site and submit the same sitemap.
- Check a title page with Google's Rich Results Test and a share preview (e.g. pasting a link into Slack or WhatsApp).
- Install it on a phone and check the launch screen and status bar (see [PWA](pwa.md)).

## Donations

Ko-fi (`https://ko-fi.com/evets511`, display name "Local Shelf") is embedded on `/support`. The URL lives in one place: `KOFI_URL` in `src/components/Support.tsx`.

## Expanding to other libraries

The name and domain were picked so other library services could live at subdomains (e.g. `brighton.localshelf.uk`). The code is currently single-library: Brighton & Hove wording, `LIBRARY_LINKS` and the Spydus base URL would need to become per-deployment configuration first.
