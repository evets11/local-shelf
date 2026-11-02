// Local Shelf service worker. Deliberately narrow:
// - page navigations: network first, cached copy when offline, else a built-in offline page
// - /_next/static: cache first (content-hashed, never changes)
// - /api/cards: network first; each card is also kept on its own so My List can be rebuilt
//   offline for whatever is saved now
// Everything else (live shelf checks, catalogue search, router flight/prefetch requests,
// cross-origin covers) goes straight to the network untouched.
// Responses are returned straight away and cached in the background (event.waitUntil), so
// streaming pages aren't held up and a cache error can never replace a good response.

// Bump only to throw away cached pages/data; any edit to this file already updates the worker.
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const DATA = `data-${VERSION}`;
// Not versioned: an open tab from the previous build may still need its old chunks.
const STATIC = "static";
const MAX_PAGES = 60;
const MAX_STATIC = 300;
const MAX_CARDS = 1000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, DATA, STATIC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App Router flight/prefetch data is tied to one build; never serve it from a cache.
  if (req.headers.get("RSC") || req.headers.has("Next-Router-Prefetch") || url.searchParams.has("_rsc")) return;

  if (req.mode === "navigate") event.respondWith(navigation(event, req));
  else if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(event, req));
  else if (url.pathname === "/api/cards") event.respondWith(cards(event, req, url));
});

/** Network first. Offline (fetch rejects) gets the last copy, else the offline page. */
async function navigation(event, req) {
  let res;
  try {
    res = await fetch(req);
  } catch {
    const cached = await caches.match(req, { cacheName: PAGES, ignoreVary: true });
    return cached ?? offlinePage();
  }
  if (res.ok) event.waitUntil(put(PAGES, req, res.clone(), MAX_PAGES));
  return res;
}

async function cacheFirst(event, req) {
  const cached = await caches.match(req, { cacheName: STATIC });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) event.waitUntil(put(STATIC, req, res.clone(), MAX_STATIC));
  return res;
}

/** Cards by IRN. Online: pass through and remember each card. Offline: rebuild from those. */
async function cards(event, req, url) {
  try {
    const res = await fetch(req);
    if (res.ok) event.waitUntil(rememberCards(res.clone()));
    return res;
  } catch (e) {
    const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
    const cache = await caches.open(DATA);
    const found = [];
    for (const id of ids) {
      const hit = await cache.match(cardKey(id));
      if (hit) found.push(await hit.json());
    }
    if (ids.length && !found.length) throw e;
    return new Response(JSON.stringify(found), {
      headers: { "Content-Type": "application/json", "X-Shelf-Offline": "1" },
    });
  }
}

const cardKey = (irn) => new Request(`/__card/${encodeURIComponent(irn)}`);

async function rememberCards(res) {
  const list = await res.json();
  const cache = await caches.open(DATA);
  for (const card of list)
    if (card && card.irn)
      await cache.put(cardKey(card.irn), new Response(JSON.stringify(card), { headers: { "Content-Type": "application/json" } }));
  await trim(cache, MAX_CARDS);
}

/** Store and keep the cache to `max` entries (oldest first out). */
async function put(name, req, res, max) {
  const cache = await caches.open(name);
  await cache.put(req, res);
  await trim(cache, max);
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(old);
}

// Self-contained: a cached Next page would need chunks a later build may have removed.
function offlinePage() {
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e1014"><title>Offline · Local Shelf</title>
<style>
  html,body{margin:0;height:100%;background:#0e1014;color:#f2f2f2;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif}
  main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));box-sizing:border-box;gap:12px}
  
  h1{font-size:24px;margin:8px 0 0}
  p{margin:0;color:#a1a1aa;max-width:28rem}
  button{margin-top:12px;font:inherit;font-weight:600;border:0;border-radius:999px;padding:12px 24px;background:#3d8ae8;color:#03122b}
  a{color:#3d8ae8}
</style></head><body><main>
<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0057b8"/><rect x="14" y="16" width="9" height="34" rx="2" fill="#f7f2e8"/><rect x="26" y="12" width="9" height="38" rx="2" fill="#f7f2e8"/><rect x="38" y="20" width="9" height="30" rx="2" transform="rotate(-12 42 35)" fill="#e0573a"/></svg>
<h1>You're offline</h1>
<p>This page isn't saved on your device yet. Pages you've opened before, and <a href="/my-list">My List</a>, still work.</p>
<button onclick="location.reload()">Try again</button>
</main></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
