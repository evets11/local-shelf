// Polite HTTP client for the Brighton & Hove Spydus OPAC. Server-only (no fs), safe to import from route handlers.
import { Limiter, LocalLimitError } from "../concurrency";
import { CONTACT_URL } from "../source";
import type { CardTitle } from "../card";
import type { Kind, LiveAvailability, Title } from "../types";
import { buildTitle, isEItem } from "./build";
import {
  extractSetId,
  isHoldingsResponse,
  parseFullRecord,
  parseHoldings,
  parseListPage,
  type ListRecord,
} from "./parse";
import { SPYDUS_BASE, urls } from "./urls";

export { SPYDUS_BASE, urls } from "./urls";

// Lets the library reach whoever runs this copy (CONTACT_URL, else the deployed repo).
export const USER_AGENT = `LocalShelf community catalogue${CONTACT_URL ? ` (+${CONTACT_URL})` : ""}`;

export class SpydusError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// ---------- concurrency + pacing ----------

export { LocalLimitError };


/** Sync (batch) path: max 2 in flight, paced. */
const syncSlots = new Limiter(2);
let lastStart = 0;
/** Grows on 5xx/429 so the sync backs off harder for the rest of the process. */
let penaltyMs = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sync path: slot plus a 300-500ms gap between request starts, plus any 5xx/429 penalty. */
async function acquire() {
  await syncSlots.take();
  const gap = 300 + Math.random() * 200 + penaltyMs;
  const wait = lastStart + gap - Date.now();
  lastStart = Math.max(Date.now(), lastStart + gap);
  if (wait > 0) await sleep(wait);
}

function release() {
  syncSlots.release();
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
}

export const stats = { requests: 0, errors: 0, retries: 0 };

class RetryableError extends SpydusError {
  constructor(message: string, status: number | undefined, readonly delayMs = 0) {
    super(message, status);
  }
}

async function fetchOnce(url: string, timeoutMs: number): Promise<string> {
  await acquire();
  try {
    stats.requests++;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (res.status === 429 || res.status >= 500) {
      penaltyMs = Math.min(penaltyMs + 1000, 10_000);
      const ra = parseInt(res.headers.get("retry-after") ?? "", 10);
      throw new RetryableError(`HTTP ${res.status} for ${url}`, res.status, Number.isFinite(ra) ? ra * 1000 : 0);
    }
    if (!res.ok) throw new SpydusError(`HTTP ${res.status} for ${url}`, res.status);
    const text = await res.text();
    penaltyMs = Math.max(0, penaltyMs - 100);
    return text;
  } catch (e) {
    stats.errors++;
    // Network errors and timeouts are retryable too.
    if (e instanceof SpydusError) throw e;
    throw new RetryableError(`${(e as Error).message} for ${url}`, undefined);
  } finally {
    release();
  }
}

/** GET a Spydus path (or absolute URL) as text, with pacing, retries and timeout. */
export async function spydusFetch(pathOrUrl: string, opts: FetchOptions = {}): Promise<string> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : SPYDUS_BASE + pathOrUrl;
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(url, timeoutMs);
    } catch (e) {
      if (!(e instanceof RetryableError) || attempt >= retries) throw e;
      stats.retries++;
      await sleep(Math.max(e.delayMs, 2000 * 2 ** attempt + Math.random() * 1000));
    }
  }
}

// ---------- live availability (request path) ----------
// Visitors wait on this, so it has its own budget: one deadline for the whole lookup, short
// timeouts, no retries inside a fetch, and none of the sync's shared pacing or penalty.

const LIVE_BUDGET_MS = 8_000;
const LIVE_REQUEST_TIMEOUT_MS = 4_000;
/** Max wait for a live slot, so queueing can't eat the whole budget. */
const LIVE_SLOT_WAIT_MS = 3_000;
/** Per server instance; results are cached upstream for 5 min. Separate from the sync's slots. */
const liveSlots = new Limiter(3);
/** Searches can hold a slot for up to 15s, so they get their own pool and can't starve shelf checks. */
const searchSlots = new Limiter(2);

type Fetcher = (pathOrUrl: string) => Promise<string>;

/** One attempt, bounded by `deadline`. 429/5xx fail fast (Retry-After isn't honoured here). */
function liveFetcher(deadline: number, requestTimeoutMs = LIVE_REQUEST_TIMEOUT_MS, slots = liveSlots): Fetcher {
  return async (pathOrUrl) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new LocalLimitError("Live availability budget exhausted");
    await slots.take(Math.min(deadline, Date.now() + LIVE_SLOT_WAIT_MS));
    try {
      stats.requests++;
      const res = await fetch(pathOrUrl.startsWith("http") ? pathOrUrl : SPYDUS_BASE + pathOrUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(Math.min(requestTimeoutMs, Math.max(1, deadline - Date.now()))),
        redirect: "follow",
      });
      if (!res.ok) throw new SpydusError(`HTTP ${res.status} for ${pathOrUrl}`, res.status);
      return await res.text();
    } finally {
      slots.release();
    }
  };
}

let cachedSetId: string | null = null;

/** Fresh set id via the robots-allowed BRN lookup; also becomes the cached live set. */
export async function freshSetIdFromBrn(brn: string, get: Fetcher = (u) => spydusFetch(u)): Promise<string> {
  const html = await get(urls.brn(brn));
  const id = extractSetId(html);
  if (!id) throw new SpydusError(`No set id in BRN lookup for ${brn}`);
  cachedSetId = id;
  return id;
}

let refreshing: Promise<string> | null = null;
/** Any live set works for XHLD, so concurrent shelf checks share one refresh. */
function sharedFreshSetId(brn: string, get: Fetcher): Promise<string> {
  refreshing ??= freshSetIdFromBrn(brn, get).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function fetchHoldingsHtml(get: Fetcher, setId: string, irn: string): Promise<string> {
  const html = await get(urls.holdings(setId, irn));
  if (!isHoldingsResponse(html, irn)) throw new SpydusError(`Unexpected XHLD response for ${irn}`);
  return html;
}

/**
 * Live per-copy availability, within ~8s. Tries XHLD with the cached set id; on failure (or no
 * cached id) gets a fresh set id via the robots-allowed BRN lookup and tries once more.
 */
export async function getLiveAvailability(brn: string | null, irn: string): Promise<LiveAvailability> {
  if (!/^\d+$/.test(irn)) throw new SpydusError(`Bad IRN ${irn}`);
  availabilityBreaker.check();
  availabilityLimit.take("shelf checks");
  try {
    const result = await liveAvailabilityUncached(brn, irn);
    availabilityBreaker.ok();
    return result;
  } catch (e) {
    if (!(e instanceof LocalLimitError)) availabilityBreaker.fail();
    throw e;
  }
}

async function liveAvailabilityUncached(brn: string | null, irn: string): Promise<LiveAvailability> {
  const get = liveFetcher(Date.now() + LIVE_BUDGET_MS);
  const tryXhld = (setId: string | null) =>
    setId ? fetchHoldingsHtml(get, setId, irn).catch(() => null) : Promise.resolve(null);
  const tried = cachedSetId;
  let html = await tryXhld(tried);
  // Another request may have refreshed the shared set while ours was failing.
  if (html === null && cachedSetId !== tried) html = await tryXhld(cachedSetId);
  if (html === null) {
    if (!brn) throw new LocalLimitError(`No cached set id and no BRN for IRN ${irn}`);
    html = await fetchHoldingsHtml(get, await sharedFreshSetId(brn, get), irn);
  }
  const holdings = parseHoldings(html);
  return {
    irn,
    fetchedAt: new Date().toISOString(),
    holdings,
    copies: holdings.length,
    available: holdings.filter((h) => h.available).length,
  };
}

// ---------- live full-catalogue search (request path) ----------
// Relays a person's own search for books/audiobooks beyond our "newest" index. Gentle by design:
// one ENQ per search, results cached, and a per-instance cap on how often we hit the library.

export class RateLimitedError extends SpydusError {}
export class ExpiredResultError extends SpydusError {}
export class BadRequestError extends SpydusError {}
/** The IRN isn't a book/audiobook. A fact about the record, so safe to remember by IRN. */
export class NotBookError extends BadRequestError {}

export type SearchKind = "book" | "audiobook";

/** A search result card. `pos` + the response's setId are needed to open the full record. */
export interface LibraryHit extends CardTitle {
  pos: number;
  summary: string | null;
  isEItem: boolean;
}

export interface LibrarySearchResult {
  setId: string;
  total: number;
  hits: LibraryHit[];
}

/** QRY filters per kind: print books only (no e-items or audio CDs); all audiobooks (CDs + e). */
export const SEARCH_FILTERS: Record<SearchKind, string> = {
  book: "DYN: FBK - BIBITM> (DYN: XDA) - BTYP: I",
  audiobook: "BTYP: I",
};

/** Kids profile: junior audience codes. e-items carry no audience code, so these return CDs only. */
export const CHILDREN_FILTERS: Record<SearchKind, string> = {
  book: "DYN: FBK + AUD: (J / A / B) - BIBITM> (DYN: XDA) - BTYP: I",
  audiobook: "BTYP: I + AUD: (J / A / B)",
};

export type SearchAudience = "children" | null;

const SEARCH_BUDGET_MS = 15_000;
const RECORD_BUDGET_MS = 12_000;
const RECORD_REQUEST_TIMEOUT_MS = 8_000;

/** Tiny LRU with per-entry TTL. Stores promises so concurrent identical requests share one fetch. */
class TtlLru<V> {
  private map = new Map<string, { at: number; v: Promise<V> }>();
  constructor(
    private readonly max: number,
    private readonly ttlMs: number,
  ) {}
  get(k: string): Promise<V> | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    this.map.delete(k);
    if (Date.now() - e.at > this.ttlMs) return undefined;
    this.map.set(k, e);
    return e.v;
  }
  delete(k: string) {
    this.map.delete(k);
  }
  set(k: string, v: Promise<V>) {
    this.map.delete(k);
    this.map.set(k, { at: Date.now(), v });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
    // Failures aren't cached.
    v.catch(() => {
      if (this.map.get(k)?.v === v) this.map.delete(k);
    });
  }
}

/** Sliding-window cap on library hits per server instance, across all visitors. */
class WindowLimit {
  private hits: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}
  take(what: string) {
    const now = Date.now();
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.max) throw new RateLimitedError(`Too many ${what} right now, try again in a minute`);
    this.hits.push(now);
  }
}

// Spydus sets outlived a 3h probe and FULL resolves by IRN with any live set, but keep cached
// set ids young anyway: 10 min here and at the CDN (s-maxage=600).
export const SEARCH_TTL_S = 600;
const searchCache = new TtlLru<LibrarySearchResult>(200, SEARCH_TTL_S * 1000);
const recordCache = new TtlLru<Title>(200, 10 * 60_000);
const searchLimit = new WindowLimit(30, 60_000);
const recordLimit = new WindowLimit(60, 60_000);
const availabilityLimit = new WindowLimit(120, 60_000);

/** After repeated upstream failures, stop calling the library for a minute instead of piling on. */
class Breaker {
  private failures = 0;
  private openUntil = 0;
  constructor(
    private readonly threshold: number,
    private readonly coolMs: number,
  ) {}
  check() {
    if (Date.now() < this.openUntil) throw new SpydusError("Library catalogue is struggling, backing off");
  }
  ok() {
    this.failures = 0;
  }
  fail() {
    if (++this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.coolMs;
      this.failures = 0;
    }
  }
}
const availabilityBreaker = new Breaker(5, 60_000);

/** IRNs that turned out not to be books/audiobooks, so repeats don't reach the library. */
const recordFailures = new Map<string, { at: number; err: SpydusError }>();
const RECORD_FAILURE_TTL_MS = 5 * 60_000;
function rememberFailure(irn: string, err: unknown) {
  if (!(err instanceof NotBookError)) return;
  recordFailures.set(irn, { at: Date.now(), err });
  if (recordFailures.size > 2000) recordFailures.delete(recordFailures.keys().next().value!);
}
/** IRN -> BRN from records fetched here, so an expired set can still be recovered. */
const knownBrns = new Map<string, string>();

/** Trimmed, whitespace-collapsed query; 3-100 chars. */
export function normaliseQuery(q: unknown): string {
  if (typeof q !== "string") throw new BadRequestError("Missing search text");
  const t = q.replace(/\s+/g, " ").trim();
  if (t.length < 3 || t.length > 100) throw new BadRequestError("Search text must be 3-100 characters");
  // Punctuation-only (or mangled U+FFFD) text would be a match-all search upstream.
  if (t.includes("\uFFFD") || (t.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 2)
    throw new BadRequestError("Search for some words or a name");
  return t;
}

const formatOf = (kind: SearchKind, r: Pick<ListRecord, "formatIcon">): Title["format"] =>
  kind === "book"
    ? r.formatIcon === "Large Print"
      ? "Large print"
      : "Book"
    : r.formatIcon === "eAudioBook"
      ? "eAudiobook"
      : "Audiobook CD";

/** Map a parsed search page to hits. Exported for tests. */
export function toLibraryHits(
  kind: SearchKind,
  records: ListRecord[],
  audience: SearchAudience = null,
): LibraryHit[] {
  return records.map((r) => ({
    irn: r.irn,
    kind,
    title: r.title,
    byline: r.author,
    year: r.year,
    poster: r.coverUrl,
    certificate: null,
    genres: [],
    available: r.available,
    copies: r.copies,
    format: formatOf(kind, r),
    rtScore: null,
    branches: [],
    availableAt: [],
    audience,
    onOrder: false,
    pos: r.position,
    summary: r.summary,
    isEItem: isEItem(r),
  }));
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Spydus "relevance" is close to alphabetical, so re-rank its top results: exact title, title
 * prefix, all words in title, then partial title/author matches. Ties keep the library's order.
 */
export function rankHits(query: string, hits: LibraryHit[]): LibraryHit[] {
  const q = fold(query);
  const words = q.split(" ").filter(Boolean);
  const score = (h: LibraryHit) => {
    const title = fold(h.title);
    const main = fold(h.title.split(/ : | ; /)[0]);
    const by = fold(h.byline ?? "");
    const inTitle = words.filter((w) => title.split(" ").includes(w)).length;
    const inBy = words.filter((w) => by.split(" ").includes(w)).length;
    return (
      (main === q || title === q ? 1000 : 0) +
      (title.startsWith(q) ? 300 : 0) +
      (inTitle === words.length ? 200 : 0) +
      inTitle * 20 +
      inBy * 15
    );
  };
  return hits
    .map((h, i) => ({ h, i, s: score(h) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.h);
}

const NO_HITS = /did not find any records/i;

/** One uncached library search (counts against the rate cap). */
async function runSearch(kind: SearchKind, query: string, audience: SearchAudience): Promise<LibrarySearchResult> {
  searchLimit.take("searches");
  const get = liveFetcher(Date.now() + SEARCH_BUDGET_MS, SEARCH_BUDGET_MS, searchSlots);
  const html = await get(urls.keywordSearch(query, (audience ? CHILDREN_FILTERS : SEARCH_FILTERS)[kind]));
  const page = parseListPage(html, kind);
  if (!page.setId) {
    // Only the library's explicit "did not find any records" is a no-results answer; any other
    // page without a set (maintenance, error) is an upstream failure and isn't cached.
    if (NO_HITS.test(html)) return { setId: "", total: 0, hits: [] };
    throw new SpydusError("Unexpected search response");
  }
  const hits = rankHits(query, toLibraryHits(kind, page.records, audience));
  return { setId: page.setId, total: page.total ?? page.records.length, hits };
}

const searchKey = (kind: SearchKind, query: string, audience: SearchAudience) =>
  `${kind}|${audience ?? "all"}|${query.toLowerCase()}`;

/**
 * Live keyword search of the whole catalogue for books or audiobooks (top 40, re-ranked).
 * `audience: "children"` narrows to junior items and marks hits as children's.
 */
export function searchLibrary(
  kind: SearchKind,
  q: string,
  audience: SearchAudience = null,
): Promise<LibrarySearchResult> {
  if (!(kind in SEARCH_FILTERS)) throw new BadRequestError("Unknown kind");
  if (audience !== null && audience !== "children") throw new BadRequestError("Unknown audience");
  const query = normaliseQuery(q);
  const key = searchKey(kind, query, audience);
  const hit = searchCache.get(key);
  if (hit) return hit;
  const p = runSearch(kind, query, audience);
  searchCache.set(key, p);
  return p;
}

/**
 * The hit's set looks expired: try the record's BRN, else the original search (cached, and
 * rate-capped like any search) for a fresh set, and fetch the IRN from it.
 */
async function recoverExpired(get: Fetcher, irn: string, ctx: RecordContext): Promise<string> {
  const expired = () => new ExpiredResultError("This result has expired, search again");
  const brn = knownBrns.get(irn);
  if (brn) {
    const html = await get(urls.brn(brn));
    if (parseFullRecord(html).irn === irn) return html;
  }
  if (!ctx.kind || !(ctx.kind in SEARCH_FILTERS) || !ctx.q) throw expired();
  const audience = ctx.audience === "children" ? "children" : null;
  // The cached search first (free); if its set is dead too, search once more.
  for (const fresh of [false, true]) {
    if (fresh) searchCache.delete(searchKey(ctx.kind, normaliseQuery(ctx.q), audience));
    const result = await searchLibrary(ctx.kind, ctx.q, audience);
    // Only IRNs that search actually returned, so made-up ones can't trigger library searches.
    const hit = result.hits.find((h) => h.irn === irn);
    if (!result.setId || !hit) break;
    // Timeouts/5xx propagate (502, retryable); only a wrong record means the set is dead.
    const html = await get(urls.full(result.setId, irn, hit.pos));
    if (parseFullRecord(html).irn === irn) return html;
  }
  throw expired();
}

/** A ListRecord rebuilt from the full page, so this works on any server instance. */
function recordFromFull(irn: string, pos: number, full: ReturnType<typeof parseFullRecord>): ListRecord {
  return {
    irn,
    position: pos,
    rawTitle: full.rawTitle,
    title: full.title,
    year: full.year,
    author: full.authors[0] ?? null,
    summary: full.summary,
    ean: full.isbn ?? full.ean,
    coverUrl: full.coverUrl,
    available: 0,
    copies: 0,
    reserved: 0,
    formatIcon: full.formatIcon,
  };
}

const KIND_BY_ICON: Record<string, Kind> = {
  Book: "book",
  "Large Print": "book",
  Audiobooks: "audiobook",
  eAudioBook: "audiobook",
};

/**
 * Full record + live holdings for a search hit, built like the sync's Titles (firstSeen = now).
 * Needs the hit's set id and position; if the set has expired and we don't know the BRN, throws
 * ExpiredResultError ("search again").
 */
export interface RecordContext {
  /** The search that produced the hit, so an expired set can be refreshed by re-running it. */
  kind?: SearchKind;
  q?: string;
  audience?: SearchAudience;
}

export function getLibraryRecord(setId: string, irn: string, pos: number, ctx: RecordContext = {}): Promise<Title> {
  if (!/^\d{1,12}$/.test(setId) || !/^\d{1,12}$/.test(irn) || !Number.isInteger(pos) || pos < 1 || pos > 10_000)
    throw new BadRequestError("Bad record reference");
  const cached = recordCache.get(irn);
  if (cached) return cached;
  const failed = recordFailures.get(irn);
  if (failed && Date.now() - failed.at < RECORD_FAILURE_TTL_MS) return Promise.reject(failed.err);
  recordLimit.take("record lookups");
  const p = (async () => {
    const get = liveFetcher(Date.now() + RECORD_BUDGET_MS, RECORD_REQUEST_TIMEOUT_MS);
    let full = parseFullRecord(await get(urls.full(setId, irn, pos)));
    if (full.irn !== irn) full = parseFullRecord(await recoverExpired(get, irn, ctx));
    const kind = full.formatIcon ? KIND_BY_ICON[full.formatIcon] : undefined;
    if (!kind) throw new NotBookError(`Not a book or audiobook (${full.formatIcon ?? "unknown format"})`);
    if (full.brn) knownBrns.set(irn, full.brn);
    if (knownBrns.size > 5000) knownBrns.delete(knownBrns.keys().next().value!);
    const rec = recordFromFull(irn, pos, full);
    let holdings: ReturnType<typeof parseHoldings> | null = null;
    if (!isEItem(rec)) {
      // Holdings are a bonus: if they fail, the record still shows (counts 0, branches unknown).
      try {
        const setForXhld = full.setId ?? setId;
        holdings = parseHoldings(await fetchHoldingsHtml(get, setForXhld, irn));
      } catch {
        holdings = null;
      }
    }
    const title = buildTitle(kind, rec, null, full, undefined, holdings, null, new Date().toISOString());
    // Physical item whose live holdings failed: counts/branches are unknown, not zero.
    return !isEItem(rec) && holdings === null ? { ...title, holdingsUnknown: true } : title;
  })();
  p.then(
    // Shelf info failed this time: don't serve that to everyone for the cache's lifetime.
    (t) => t.holdingsUnknown && recordCache.delete(irn),
    (e) => rememberFailure(irn, e),
  );
  recordCache.set(irn, p);
  return p;
}

