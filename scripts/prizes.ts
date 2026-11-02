// Fetch UK book prize lists from Wikipedia and find which books the library holds.
// Writes data/prizes.json; the nightly sync then keeps the matched records in the catalogue.
//
// Usage: npm run prizes -- [--force] [--offline] [--max-searches N]
//   --force          run even if the lists were checked in the last 6 days
//   --offline        no network: re-read cached Wikipedia pages and library searches
//   --max-searches N library searches this run (default 40); 0 matches against our index only
//
// Library searches are disallowed by the catalogue's robots.txt, so they're kept rare: only for
// books not already in our index, once when first listed, then about monthly for a few months.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { CONTACT_URL } from "../src/lib/source";
import { PRODUCTION_URL } from "../src/lib/site";
import {
  PRIZES,
  type Prize,
  type PrizeEntry,
  type PrizesFile,
} from "../src/lib/prizes/config";
import { searchText, type Candidate } from "../src/lib/prizes/match";
import {
  addMatches,
  entriesFromPages,
  indexCandidates,
  looksBroken,
  mergeEntries,
  needsSearch,
  searchCandidates,
  searchOrder,
  type PrizePage,
} from "../src/lib/prizes/update";
import {
  formatOf,
  NO_HITS,
  SEARCH_FILTERS,
  spydusFetch,
  stats,
  urls,
} from "../src/lib/spydus/client";
import { parseFullRecord, parseListPage } from "../src/lib/spydus/parse";
import type { Catalog } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "prizes.json");
const WIKI_CACHE = join(ROOT, ".cache", "prizes");
const SPYDUS_CACHE = join(ROOT, ".cache", "spydus");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const OFFLINE = args.includes("--offline");
const maxIdx = args.indexOf("--max-searches");
const MAX_SEARCHES = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 40;
if (!(Number.isInteger(MAX_SEARCHES) && MAX_SEARCHES >= 0)) {
  console.error(
    `--max-searches needs a whole number, got ${JSON.stringify(args[maxIdx + 1])}`,
  );
  process.exit(64);
}
/** Wikipedia is checked weekly; the nightly workflow calls this every night. */
const MIN_DAYS_BETWEEN = 6;

const log = (...a: unknown[]) => console.log(...a);

function writeJson(path: string, data: unknown) {
  const tmp = `${path}.tmp`;
  // Pretty: it's small and the weekly diffs are worth reading.
  writeFileSync(tmp, JSON.stringify(data, null, 1) + "\n");
  renameSync(tmp, path);
}

function cached(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}
function save(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// ---------- Wikipedia ----------

const WIKI_UA = `LocalShelf prize lists (${CONTACT_URL ?? PRODUCTION_URL})`;

/** Wikitext of a page, or null if it doesn't exist (e.g. next year's Booker page). */
async function wikitext(page: string): Promise<string | null> {
  const file = join(WIKI_CACHE, `${page.replace(/[^\w-]+/g, "_")}.wikitext`);
  if (OFFLINE) return cached(file);
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({
    action: "parse",
    page,
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    redirects: "1",
    maxlag: "5",
  }).toString();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(u, {
      headers: { "User-Agent": WIKI_UA },
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as {
      parse?: { wikitext: string };
      error?: { code: string; info: string };
    } | null;
    if (json?.parse) {
      save(file, json.parse.wikitext);
      return json.parse.wikitext;
    }
    if (json?.error?.code === "missingtitle") return null;
    if (
      attempt < 2 &&
      (res.status >= 500 ||
        res.status === 429 ||
        json?.error?.code === "maxlag")
    ) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    throw new Error(
      `Wikipedia ${res.status} for "${page}": ${json?.error?.info ?? "unexpected response"}`,
    );
  }
}

async function prizePages(prize: Prize, year: number): Promise<PrizePage[]> {
  if (typeof prize.page === "string") {
    const w = await wikitext(prize.page);
    if (w === null) throw new Error(`No Wikipedia page "${prize.page}"`);
    return [{ year: null, wikitext: w }];
  }
  // A page per year: this year's may not exist yet, so look back far enough to find two.
  const pages: PrizePage[] = [];
  for (const y of [year, year - 1, year - 2]) {
    const w = await wikitext(prize.page(y));
    if (w !== null) pages.push({ year: y, wikitext: w });
  }
  return pages;
}

// ---------- the library ----------

const SEARCH_FILTER = `${SEARCH_FILTERS.book} / ${SEARCH_FILTERS.audiobook}`;

/** A cached search is reused for 12 hours (re-runs while testing), or forever with --offline. */
const SEARCH_CACHE_MS = 12 * 3_600_000;

/** One library search, cached on disk. */
async function librarySearch(q: string): Promise<string | null> {
  const file = join(
    SPYDUS_CACHE,
    "prize-search",
    `${q.replace(/[^\w]+/g, "-").slice(0, 120)}.html`,
  );
  // Old results would hide new stock from monthly retries, and their set ids have expired.
  const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < SEARCH_CACHE_MS;
  if (OFFLINE || fresh) return cached(file);
  const html = await spydusFetch(urls.keywordSearch(q, SEARCH_FILTER), {
    timeoutMs: 30_000,
    retries: 2,
  });
  save(file, html);
  return html;
}

/** The full record for a search hit, for its BRN. Shares the sync's FULL cache. */
async function fullRecord(setId: string, irn: string, pos: number) {
  const file = join(SPYDUS_CACHE, "full", `${irn}.html`);
  const hit = cached(file);
  if (hit && parseFullRecord(hit).irn === irn) return parseFullRecord(hit);
  if (OFFLINE) return null;
  const html = await spydusFetch(urls.full(setId, irn, pos));
  const full = parseFullRecord(html);
  if (full.irn !== irn) throw new Error(`FULL ${irn}: got ${full.irn}`);
  save(file, html);
  return full;
}

/** Search for one book. Returns null if the search couldn't be completed (try again next run). */
async function lookUp(
  e: PrizeEntry,
): Promise<Candidate[] | null> {
  const q = searchText(e.title, e.authors);
  const html = await librarySearch(q);
  if (html === null) return null;
  const records = (["book", "audiobook"] as const).flatMap((kind) =>
    parseListPage(html, kind).records.map((rec) => ({
      rec,
      kind,
      format: formatOf(kind, rec),
    })),
  );
  const setId = parseListPage(html).setId;
  if (!setId) {
    if (NO_HITS.test(html)) return [];
    throw new Error(`Unexpected search response for "${q}"`);
  }
  const cands = searchCandidates(e, records);
  const picked = addMatches([], cands);
  const withBrn: Candidate[] = [];
  for (const m of picked) {
    const c = cands.find((x) => x.irn === m.irn)!;
    const full = await fullRecord(setId, c.irn, c.position);
    // The sync needs a BRN to fetch it; skip this format rather than search again every week.
    if (!full?.brn) {
      log(`  ${c.irn}: no BRN in its full record, skipped`);
      continue;
    }
    withBrn.push({ ...m, brn: full.brn, copies: c.copies });
  }
  log(
    `  "${q}": ${records.length} results, ${withBrn.length ? withBrn.map((m) => m.format).join(", ") : "not held"}`,
  );
  return withBrn;
}

// ---------- main ----------

function loadIndex() {
  return (["books", "audiobooks"] as const).flatMap((k) => {
    const p = join(ROOT, "data", `catalog-${k}.json`);
    return existsSync(p)
      ? (JSON.parse(readFileSync(p, "utf8")) as Catalog).titles
      : [];
  });
}

async function main() {
  const now = new Date().toISOString();
  const prev: PrizesFile = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : { checkedAt: null, entries: [] };
  if (!FORCE && !OFFLINE && prev.checkedAt) {
    const days = (Date.parse(now) - Date.parse(prev.checkedAt)) / 86_400_000;
    if (days < MIN_DAYS_BETWEEN) {
      log(
        `Prize lists checked ${days.toFixed(1)} days ago; next check after ${MIN_DAYS_BETWEEN} days (--force to run now).`,
      );
      return;
    }
  }

  // 1. Lists. A prize that fails or looks broken keeps its previous entries.
  const year = new Date(now).getUTCFullYear();
  let failed = false;
  const entries: PrizeEntry[] = [];
  for (const prize of PRIZES) {
    const before = prev.entries.filter((e) => e.prize === prize.id);
    try {
      const fresh = entriesFromPages(prize, await prizePages(prize, year));
      if (looksBroken(before, fresh)) {
        log(
          `!!! ${prize.name}: parsed ${fresh.length} books (had ${before.length}); keeping the previous list`,
        );
        failed = true;
        entries.push(...before);
        continue;
      }
      const years = [...new Set(fresh.map((e) => e.year))].join(", ");
      log(`${prize.name}: ${fresh.length} books (${years})`);
      entries.push(...mergeEntries(before, fresh, now));
    } catch (e) {
      log(
        `!!! ${prize.name}: ${(e as Error).message}; keeping the previous list`,
      );
      failed = true;
      entries.push(...before);
    }
  }

  // 2. Our own index first: free, and no library searches.
  const index = loadIndex();
  for (const e of entries)
    e.matches = addMatches(e.matches, indexCandidates(e, index));

  // 3. Library searches for the rest, capped per run.
  const todo = entries.filter((e) => needsSearch(e, now)).sort(searchOrder);
  const budget = OFFLINE ? todo.length : MAX_SEARCHES;
  log(
    `${entries.filter((e) => e.matches.length).length}/${entries.length} found in our index; ${todo.length} to search, up to ${budget} this run`,
  );
  let consecutiveFailures = 0;
  for (const e of todo.slice(0, budget)) {
    try {
      const found = await lookUp(e);
      consecutiveFailures = 0;
      if (found === null) continue;
      e.matches = addMatches(e.matches, found);
      if (!OFFLINE)
        e.searched = { at: now, tries: (e.searched?.tries ?? 0) + 1 };
    } catch (err) {
      log(`  search for "${e.title}" failed: ${(err as Error).message}`);
      failed = true;
      if (++consecutiveFailures >= 3) {
        log("!!! 3 searches failed in a row; stopping searches for this run");
        break;
      }
    }
  }

  const order = new Map(PRIZES.map((p, i) => [p.id, i]));
  entries.sort(
    (a, b) => order.get(a.prize)! - order.get(b.prize)! || searchOrder(a, b),
  );
  writeJson(OUT, {
    // After a failure, don't wait a week: the next nightly run tries again.
    checkedAt: OFFLINE || failed ? prev.checkedAt : now,
    entries,
  } satisfies PrizesFile);
  const held = entries.filter((e) => e.matches.length).length;
  log(
    `wrote ${entries.length} prize books, ${held} held by the library. HTTP to the library: ${stats.requests} requests`,
  );
  if (failed) process.exitCode = 3;
}

main().catch((e) => {
  console.error(`FATAL: ${(e as Error).stack ?? e}`);
  process.exit(1);
});
