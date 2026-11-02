// Sync Brighton & Hove library catalogues into data/catalog-<kind>s.json.
// Usage: npm run sync -- [--kind film|book|audiobook ...] [--offline] [--full] [--no-holdings] [--limit N]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeJsonAtomic } from "../src/lib/enrich/wikidata";
import { pool } from "../src/lib/concurrency";
import { dirname, join } from "node:path";
import { buildTitle, isEItem } from "../src/lib/spydus/build";
import {
  freshSetIdFromBrn,
  spydusFetch,
  stats,
  urls,
  SPYDUS_BASE,
} from "../src/lib/spydus/client";
import {
  isHoldingsResponse,
  parseFullRecord,
  parseHoldings,
  parseListPage,
  type BookBucket,
  type FullRecord,
  type ListRecord,
} from "../src/lib/spydus/parse";
import type { Catalog, Holding, Kind, Title, TmdbInfo } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const CACHE = join(ROOT, ".cache", "spydus");
const TMDB_CACHE = join(ROOT, "data", "tmdb-cache.json");
const catalogPath = (kind: Kind, sample: boolean) =>
  // --limit runs write a sample file so they never clobber the real catalog (and its firstSeen history).
  join(ROOT, "data", `catalog-${kind}s${sample ? ".sample" : ""}.json`);

const args = process.argv.slice(2);
const OFFLINE = args.includes("--offline");
const FULL = args.includes("--full");
const NO_HOLDINGS = args.includes("--no-holdings");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
if (limitIdx >= 0 && !(Number.isInteger(LIMIT) && LIMIT > 0)) {
  console.error(
    `--limit needs a positive integer, got ${JSON.stringify(args[limitIdx + 1])}`,
  );
  process.exit(64);
}
const ALL_KINDS: Kind[] = ["film", "audiobook", "book"];
const KINDS_ARG = args.flatMap((a, i) =>
  args[i - 1] === "--kind" ? [a as Kind] : [],
);
for (const k of KINDS_ARG)
  if (!ALL_KINDS.includes(k)) throw new Error(`Unknown --kind ${k}`);
const KINDS = KINDS_ARG.length
  ? ALL_KINDS.filter((k) => KINDS_ARG.includes(k))
  : ALL_KINDS;

const t0 = Date.now();
const log = (...a: unknown[]) =>
  console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s]`, ...a);

// ---------- what we sync ----------

interface ListSpec {
  name: string;
  qry: string;
  /** Newest N records; Infinity mirrors the whole list. */
  limit: number;
  bucket?: BookBucket;
}

const EAUDIO = "BIBITM> (DYN: XDA + ITMXDATYP: A + FILTER: 1)";
// Book queries otherwise also match e-items (BorrowBox/Libby) and audiobook CDs.
const PRINT_ONLY = " - BIBITM> (DYN: XDA) - BTYP: I";
const FIC = "FIC: (C / F / J / 1)";

/** Lists per kind. Order matters for books: an IRN in several lists keeps the first bucket. */
const LISTS: Record<Kind, ListSpec[]> = {
  film: [{ name: "dvd", qry: "BTYP: G", limit: Infinity }],
  audiobook: [
    { name: "audiocd", qry: `BTYP: I - ${EAUDIO}`, limit: 1000 },
    { name: "eaudio", qry: EAUDIO, limit: 500 },
  ],
  book: [
    {
      name: "junior",
      qry: `(${FIC} + AUD: (J / A / B))${PRINT_ONLY}`,
      limit: 400,
      bucket: "junior",
    },
    {
      name: "ya",
      qry: `(${FIC} + AUD: (C / D))${PRINT_ONLY}`,
      limit: 300,
      bucket: "young-adult",
    },
    {
      name: "adultfic",
      qry: `(${FIC} - AUD: (J / A / B / C / D))${PRINT_ONLY}`,
      limit: 800,
      bucket: "adult-fiction",
    },
    {
      name: "adultnf",
      qry: `(DYN: FBK - ${FIC} - AUD: (J / A / B / C / D))${PRINT_ONLY}`,
      limit: 600,
      bucket: "adult-nonfiction",
    },
  ],
};

/** Nightly XHLD for every physical item; e-items (BorrowBox/Libby) have no copies to locate. */
const wantsHoldings = (r: ListRecord) => !isEItem(r);

// ---------- raw html cache ----------

const cachePath = (dir: string, key: string) => join(CACHE, dir, `${key}.html`);
function readCache(dir: string, key: string): string | null {
  const p = cachePath(dir, key);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}
function writeCache(dir: string, key: string, html: string) {
  const p = cachePath(dir, key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html);
}

// ---------- abort on sustained server trouble ----------

let consecutiveFailures = 0;
function noteResult(ok: boolean) {
  consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
  if (consecutiveFailures >= 8) {
    log(
      `ABORT: ${consecutiveFailures} consecutive failures, server may be struggling. Kinds already written are kept; this one is not.`,
    );
    process.exit(2);
  }
}

/** Run fn over items with at most `n` in flight (the client also caps at 2). */

// ---------- list pages ----------

let enqCount = 0;
/** Per-list result set ids: FULL/<set>/<irn>,<pos> uses that list's positions. */
const listSets = new Map<string, string>();
/** One requery per list per sync; concurrent workers await the same one. */
const requeried = new Map<string, Promise<boolean>>();

interface Rec extends ListRecord {
  list: ListSpec;
}

async function runListQuery(spec: ListSpec): Promise<string> {
  enqCount++;
  return spydusFetch(urls.listQuery(spec.qry), {
    timeoutMs: 90_000,
    retries: 2,
  });
}

async function loadList(
  kind: Kind,
  spec: ListSpec,
): Promise<{ records: Rec[]; total: number | null; cards: number }> {
  const limit = Math.min(spec.limit, LIMIT);
  const records: Rec[] = [];
  let total: number | null = null;
  let dropped = 0;
  const ingest = (html: string, label: string) => {
    const p = parseListPage(html, kind);
    if (!p.records.length && !p.dropped.length)
      throw new Error(`List ${spec.name} ${label}: no cards`);
    total ??= p.total;
    if (p.setId && !listSets.has(spec.name)) listSets.set(spec.name, p.setId);
    for (const r of p.records) records.push({ ...r, list: spec });
    dropped += p.dropped.length;
    if (kind === "film")
      for (const d of p.dropped)
        log(`  dropped ${d.irn} "${d.title}" (${d.reason})`);
  };

  if (OFFLINE) {
    for (let n = 1; records.length < limit; n++) {
      const html = readCache(`list/${spec.name}`, `page-${n}`);
      if (!html) break;
      ingest(html, `page ${n}`);
    }
  } else {
    log(`ENQ ${spec.name}: ${spec.qry}`);
    const first = await runListQuery(spec);
    writeCache(`list/${spec.name}`, "page-1", first);
    ingest(first, "page 1");
    const setId = listSets.get(spec.name);
    if (!setId) throw new Error(`No set id for list ${spec.name}`);
    const pages = total ? Math.ceil(total / 100) : 1;
    log(`  set ${setId}, ${total} records over ${pages} pages`);
    for (let n = 2; n <= pages && records.length < limit; n++) {
      log(`  PAGE ${spec.name} ${n}/${pages}...`);
      const html = await spydusFetch(urls.page(setId, n), {
        timeoutMs: 90_000,
        retries: 2,
      });
      writeCache(`list/${spec.name}`, `page-${n}`, html);
      ingest(html, `page ${n}`);
    }
  }
  log(
    `  list ${spec.name}: ${Math.min(records.length, limit)} kept, ${dropped} dropped (of ${total})`,
  );
  return {
    records: records.slice(0, limit),
    total,
    cards: records.length + dropped,
  };
}

// ---------- full records + holdings ----------

/** Any live set works for XHLD. */
let xhldSetId: string | null = null;
/** IRN -> BRN, from previous catalogs and records parsed this run. */
const brnByIrn = new Map<string, string>();
const anyBrn = () => [...brnByIrn.values()].at(-1);

/** Re-run a list query (at most once per list per sync) for a fresh set; same sort keeps positions valid. */
function requeryList(spec: ListSpec): Promise<boolean> {
  let p = requeried.get(spec.name);
  if (!p) {
    log(`list set ${spec.name} looks expired; re-running its query once`);
    p = runListQuery(spec).then((html) => {
      const id = parseListPage(html).setId;
      if (id) listSets.set(spec.name, id);
      return Boolean(id);
    });
    requeried.set(spec.name, p);
  }
  return p;
}

async function fetchFull(rec: Rec): Promise<string> {
  const full = () =>
    spydusFetch(urls.full(listSets.get(rec.list.name)!, rec.irn, rec.position));
  const html = await full();
  if (parseFullRecord(html).irn === rec.irn) return html;
  log(`  FULL ${rec.irn}: IRN mismatch, set may have expired`);
  // Known BRN: the robots-allowed BRN lookup returns the full record itself.
  const brn = brnByIrn.get(rec.irn);
  if (brn) {
    const byBrn = await spydusFetch(urls.brn(brn));
    if (parseFullRecord(byBrn).irn === rec.irn) return byBrn;
  } else if (await requeryList(rec.list)) {
    const retry = await full();
    if (parseFullRecord(retry).irn === rec.irn) return retry;
  }
  throw new Error(`FULL ${rec.irn}: IRN mismatch`);
}

async function fetchHoldings(irn: string): Promise<string> {
  const html = await spydusFetch(urls.holdings(xhldSetId!, irn), {
    timeoutMs: 20_000,
  });
  if (isHoldingsResponse(html, irn)) return html;
  log(`  XHLD ${irn}: unexpected response, refreshing set`);
  const brn = brnByIrn.get(irn) ?? anyBrn();
  if (!brn)
    throw new Error(`XHLD ${irn}: bad response and no BRN to refresh the set`);
  xhldSetId = await freshSetIdFromBrn(brn);
  const retry = await spydusFetch(urls.holdings(xhldSetId, irn), {
    timeoutMs: 20_000,
  });
  if (isHoldingsResponse(retry, irn)) return retry;
  throw new Error(`XHLD ${irn}: bad response`);
}
// ---------- TMDB ----------

/** One TMDB lookup, dated: TMDB's terms allow caching their data for at most 6 months. */
interface TmdbCacheEntry {
  at: string;
  info: TmdbInfo | null;
}
// Older caches stored bare TmdbInfo | null with no date; those count as expired.
type TmdbCache = Record<string, TmdbCacheEntry | TmdbInfo | null>;
const TMDB_MAX_AGE_DAYS = 150;

/** The entry if it's young enough. Lifetimes vary by up to 30 days per key, so refreshes spread out. */
function freshTmdb(cache: TmdbCache, ck: string): TmdbCacheEntry | undefined {
  const e = cache[ck];
  if (!e || !("at" in e)) return undefined;
  let h = 0;
  for (const c of ck) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const ageDays = (Date.now() - Date.parse(e.at)) / 86_400_000;
  return ageDays < TMDB_MAX_AGE_DAYS - (h % 30) ? e : undefined;
}
/** Loose shape covering the search and details responses we read. */
interface TmdbJson {
  results?: { id: number }[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  tagline?: string;
  videos?: {
    results?: { site: string; type: string; key: string; official?: boolean }[];
  };
}

async function tmdbEnrich(titles: Title[]) {
  const key = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_READ_TOKEN;
  if (!key && !token) {
    log("TMDB: no TMDB_API_KEY / TMDB_READ_TOKEN, skipping enrichment");
    return;
  }
  const cache: TmdbCache = existsSync(TMDB_CACHE)
    ? JSON.parse(readFileSync(TMDB_CACHE, "utf8"))
    : {};
  const tmdb = async (
    path: string,
    params: Record<string, string> = {},
    attempt = 0,
  ): Promise<TmdbJson> => {
    const u = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (key) u.searchParams.set("api_key", key);
    const res = await fetch(u, {
      headers: token
        ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
        : { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return tmdb(path, params, attempt + 1);
    }
    if (!res.ok) throw new Error(`TMDB ${res.status} ${path}`);
    return res.json();
  };

  let hits = 0;
  let queried = 0;
  await pool(titles, 4, async (t) => {
    const isTv = t.genres.includes("TV");
    const q = t.title
      .replace(/\s*\(\d{4}\)\s*$/, "")
      .replace(/:\s.*$/, (m) => (t.title.length > 40 ? "" : m));
    const ck = `${isTv ? "tv" : "movie"}|${q.toLowerCase()}|${t.year ?? ""}`;
    if (!freshTmdb(cache, ck)) {
      queried++;
      try {
        let kind: "movie" | "tv" = isTv ? "tv" : "movie";
        const search = (k: "movie" | "tv", withYear: boolean) =>
          tmdb(`/search/${k}`, {
            query: q,
            include_adult: "false",
            ...(withYear && t.year
              ? {
                  [k === "movie" ? "year" : "first_air_date_year"]: String(
                    t.year,
                  ),
                }
              : {}),
          });
        let r = await search(kind, true);
        if (!r.results?.length && t.year) r = await search(kind, false);
        if (!r.results?.length && !isTv) {
          kind = "tv";
          r = await search("tv", true);
        }
        const hit = r.results?.[0];
        const at = new Date().toISOString();
        if (!hit) cache[ck] = { at, info: null };
        else {
          const d = await tmdb(`/${kind}/${hit.id}`, {
            append_to_response: "videos",
          });
          const vids: {
            site: string;
            type: string;
            key: string;
            official?: boolean;
          }[] = d.videos?.results ?? [];
          const trailer =
            vids.find(
              (v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
            ) ??
            vids.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
            vids.find((v) => v.site === "YouTube" && v.type === "Teaser");
          cache[ck] = {
            at,
            info: {
              id: hit.id,
              posterPath: d.poster_path ?? null,
              backdropPath: d.backdrop_path ?? null,
              voteAverage:
                typeof d.vote_average === "number" && (d.vote_count ?? 0) > 0
                  ? d.vote_average
                  : null,
              trailerKey: trailer?.key ?? null,
              tagline: d.tagline || null,
            },
          };
        }
      } catch (e) {
        log(`  TMDB "${q}": ${(e as Error).message}`);
        return; // don't cache failures
      }
      if (queried % 50 === 0) writeJsonAtomic(TMDB_CACHE, cache);
    }
    const info = freshTmdb(cache, ck)?.info;
    if (info) {
      t.tmdb = info;
      hits++;
    }
  });
  writeJsonAtomic(TMDB_CACHE, cache);
  log(`TMDB: ${hits}/${titles.length} matched (${queried} new lookups)`);
}

async function syncKind(kind: Kind, now: string) {
  const file = catalogPath(kind, false);
  const prevCatalog: Catalog | null = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;
  const prev = new Map((prevCatalog?.titles ?? []).map((t) => [t.irn, t]));
  log(`=== ${kind}: previous catalog ${prev.size} titles`);
  // Seed BRNs for set refresh so a CI run with an empty cache can still recover from set expiry.
  for (const t of prev.values()) if (t.brn) brnByIrn.set(t.irn, t.brn);

  // Lists, deduped by IRN (first list wins).
  const recMap = new Map<string, Rec>();
  for (const spec of LISTS[kind]) {
    const { records, total, cards } = await loadList(kind, spec);
    // A partial list (failed page) must not silently drop known titles. Complete means we hit
    // the limit, or parsed ~all cards (junk included, since `total` counts junk too).
    // No total (broken/unknown page) is never "complete" on card count alone.
    const complete =
      records.length >= Math.min(spec.limit, LIMIT) ||
      (total !== null && cards >= total * 0.9);
    if (!Number.isFinite(LIMIT) && !complete) {
      log(
        `!!! REFUSING to write ${kind}: list ${spec.name} parsed ${cards} of ${total} cards. ` +
          `Keeping the previous ${kind} catalog; other kinds continue.`,
      );
      process.exitCode = 3;
      return;
    }
    for (const r of records) if (!recMap.has(r.irn)) recMap.set(r.irn, r);
  }
  const recs = [...recMap.values()];
  if (!xhldSetId) xhldSetId = listSets.values().next().value ?? null;

  // FULL records: cache-first so an interrupted crawl resumes cheaply; --full bypasses the cache.
  const fulls = new Map<string, FullRecord>();
  const toFetch: Rec[] = [];
  for (const r of recs) {
    const cached = FULL && !OFFLINE ? null : readCache("full", r.irn);
    if (cached) {
      const f = parseFullRecord(cached);
      if (f.irn !== r.irn)
        throw new Error(`Cached FULL ${r.irn} has IRN ${f.irn}`);
      fulls.set(r.irn, f);
      if (f.brn) brnByIrn.set(r.irn, f.brn);
    } else if (!OFFLINE && (FULL || !prev.get(r.irn)?.brn)) {
      // No BRN means a previous FULL fetch failed for this IRN.
      toFetch.push(r);
    }
  }
  log(`FULL: ${fulls.size} from cache, ${toFetch.length} to fetch`);
  let done = 0;
  await pool(toFetch, 2, async (r) => {
    try {
      const html = await fetchFull(r);
      writeCache("full", r.irn, html);
      const f = parseFullRecord(html);
      fulls.set(r.irn, f);
      if (f.brn) brnByIrn.set(r.irn, f.brn);
      noteResult(true);
    } catch (e) {
      log(`  FULL ${r.irn} failed: ${(e as Error).message}`);
      noteResult(false);
    }
    if (++done % 50 === 0 || done === toFetch.length)
      log(`FULL ${done}/${toFetch.length}`);
  });

  // Holdings: live every run for films + audiobook CDs. --offline reads the cache, which matches
  // the cached list pages, so it counts as fresh. --no-holdings online reads the cache as stale.
  const holdingRecs = recs.filter(wantsHoldings);
  const holdings = new Map<string, Holding[]>();
  const staleHoldings = new Map<string, Holding[]>();
  if (OFFLINE || NO_HOLDINGS) {
    const into = OFFLINE ? holdings : staleHoldings;
    for (const r of holdingRecs) {
      const cached = readCache("holdings", r.irn);
      if (cached) into.set(r.irn, parseHoldings(cached));
    }
    log(`holdings: ${into.size} from cache${OFFLINE ? "" : " (stale)"}`);
  } else {
    done = 0;
    await pool(holdingRecs, 2, async (r) => {
      try {
        const html = await fetchHoldings(r.irn);
        writeCache("holdings", r.irn, html);
        holdings.set(r.irn, parseHoldings(html));
        noteResult(true);
      } catch (e) {
        log(`  XHLD ${r.irn} failed: ${(e as Error).message}`);
        noteResult(false);
      }
      if (++done % 100 === 0 || done === holdingRecs.length)
        log(`holdings ${done}/${holdingRecs.length}`);
    });
  }

  const titles = recs.map((r) =>
    buildTitle(
      kind,
      r,
      r.list.bucket ?? null,
      fulls.get(r.irn) ?? null,
      prev.get(r.irn),
      holdings.get(r.irn) ?? null,
      staleHoldings.get(r.irn) ?? null,
      now,
    ),
  );
  if (prev.size === 0) log("first run: firstSeen = now for every title");
  const missingFull = titles.filter((t) => !t.brn).length;
  if (missingFull)
    log(`warning: ${missingFull} titles have no full record (no BRN)`);

  if (kind === "film") await tmdbEnrich(titles);

  titles.sort(
    (a, b) =>
      b.firstSeen.localeCompare(a.firstSeen) ||
      a.sortTitle.localeCompare(b.sortTitle),
  );
  const catalog: Catalog = {
    kind,
    generatedAt: now,
    source: SPYDUS_BASE,
    titles,
  };
  const out = catalogPath(kind, Number.isFinite(LIMIT));
  mkdirSync(dirname(out), { recursive: true });
  writeJsonAtomic(out, catalog);
  log(`wrote ${titles.length} ${kind} titles to ${out.slice(ROOT.length + 1)}`);
}

async function main() {
  const now = new Date().toISOString();
  log(
    `mode: ${OFFLINE ? "offline" : "online"}; kinds ${KINDS.join(", ")}${FULL ? " --full" : ""}` +
      `${NO_HOLDINGS ? " --no-holdings" : ""}${Number.isFinite(LIMIT) ? ` --limit ${LIMIT}` : ""}`,
  );
  for (const kind of KINDS) {
    try {
      await syncKind(kind, now);
    } catch (e) {
      // e.g. a list page that failed after retries: keep this kind's previous catalog, carry on.
      log(
        `!!! ${kind} FAILED, keeping the previous ${kind} catalog: ${(e as Error).stack ?? e}`,
      );
      process.exitCode = 3;
    }
  }
  log(
    `done. ENQ list queries: ${enqCount}. HTTP: ${stats.requests} requests, ${stats.errors} errors, ` +
      `${stats.retries} retries`,
  );
}

main().catch((e) => {
  log(`FATAL: ${(e as Error).stack ?? e}`);
  process.exit(1);
});
