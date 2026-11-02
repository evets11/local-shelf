// Wikidata/OMDb client for scripts/enrich.ts: rate limiting, backoff and a JSON cache.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { Limiter } from "../concurrency";
import { CONTACT_URL } from "../source";
import type {
  Rank,
  WdCandidate,
  WdReviewScore,
  WdValue,
  WdVideo,
} from "./match";

// Wikimedia asks for contact info in the UA (CONTACT_URL, else the deployed repo).
export const USER_AGENT = `LocalShelf/0.1 (community library catalogue${CONTACT_URL ? `; ${CONTACT_URL}` : ""})`;
const API = "https://www.wikidata.org/w/api.php";
const SPARQL = "https://query.wikidata.org/sparql";

export interface LabelRecord {
  label: string | null;
  aliases: string[];
  enwiki: string | null;
}

export interface OmdbRecord {
  imdbRating: number | null;
  rottenTomatoes: number | null;
  metascore: number | null;
}

export interface StoredDecision {
  fingerprint: string;
  qid: string | null;
  via: string | null;
  score: number;
  reason: string;
  /** Unmatched only: the cast we tried with, so a changed cast gets another go. */
  cast?: string;
}

export interface Cache {
  version: 1;
  /** Search query -> QIDs, in result order. */
  searches: Record<string, string[]>;
  /** Cheap first pass: labels/aliases/enwiki per QID (null = missing entity). */
  labels: Record<string, LabelRecord | null>;
  /** Full candidate records, only for title-matching QIDs. */
  details: Record<string, WdCandidate | null>;
  /** Subclass closures, keyed by root QID. */
  classes: Record<string, string[]>;
  omdb: Record<string, OmdbRecord | null>;
  decisions: Record<string, StoredDecision>;
}

export function emptyCache(): Cache {
  return {
    version: 1,
    searches: {},
    labels: {},
    details: {},
    classes: {},
    omdb: {},
    decisions: {},
  };
}

export function loadCache(path: string): Cache {
  if (!existsSync(path)) return emptyCache();
  const c = JSON.parse(readFileSync(path, "utf8")) as Cache;
  return { ...emptyCache(), ...c };
}

export function writeJsonAtomic(path: string, data: unknown) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data) + "\n"); // compact: these files ship in the repo / CI cache
  renameSync(tmp, path);
}

// ---------- HTTP ----------

export const stats = { search: 0, entities: 0, sparql: 0, omdb: 0, retries: 0 };

const slots = new Limiter(2);

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  await slots.take();
  try {
    return await fn();
  } finally {
    slots.release();
  }
}

const RETRYABLE = new Set(["maxlag", "cirrussearch-too-busy-error", "ratelimited"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch JSON with backoff on 429/5xx/maxlag; honours Retry-After. */
/** URL safe for logs: API keys removed. */
const redact = (url: string) => url.replace(/([?&](?:apikey|api_key|key)=)[^&]*/gi, "$1***");

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await withSlot(() =>
      fetch(url, {
        ...init,
        headers: {
          "User-Agent": USER_AGENT,
          "Api-User-Agent": USER_AGENT,
          Accept: "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(90_000),
      }).catch((e: unknown) => e as Error),
    );
    let retryAfter: number | null = null;
    if (res instanceof Error) {
      retryAfter = null;
    } else if (res.ok) {
      const body = (await res.json()) as T & { error?: { code?: string } };
      // maxlag and search overload are transient; other API errors are not.
      if (!RETRYABLE.has(body?.error?.code ?? "")) {
        if (body?.error)
          throw new Error(`API error ${JSON.stringify(body.error)} for ${redact(url)}`);
        return body;
      }
      retryAfter = Number(res.headers.get("retry-after")) || 5;
    } else if (res.status === 429 || res.status >= 500) {
      retryAfter = Number(res.headers.get("retry-after")) || null;
    } else {
      throw new Error(
        `HTTP ${res.status} for ${redact(url)}: ${(await res.text()).slice(0, 200)}`,
      );
    }
    if (attempt >= 6)
      throw new Error(
        `Giving up on ${redact(url)}: ${res instanceof Error ? res.message : res.status}`,
      );
    stats.retries++;
    if (process.env.ENRICH_DEBUG) console.error(`retry ${attempt} ${res instanceof Error ? res.message : res.status} ${redact(url).slice(0, 80)}`);
    await sleep((retryAfter ?? Math.min(60, 2 ** attempt * 2)) * 1000);
  }
}

// ---------- Wikidata ----------

/** CirrusSearch for entities with an IMDb ID. Query text is sanitised of search operators. */
export async function searchEntities(
  cache: Cache,
  text: string,
  refresh: boolean,
): Promise<string[]> {
  const clean = text
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const q = `${clean} haswbstatement:P345`;
  if (!refresh && cache.searches[q]) return cache.searches[q];
  stats.search++;
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: q,
    srnamespace: "0",
    srlimit: "20",
    srprop: "",
    format: "json",
    maxlag: "5",
  });
  const body = await fetchJson<{ query: { search: { title: string }[] } }>(
    `${API}?${params}`,
  );
  const ids = body.query.search
    .map((s) => s.title)
    .filter((t) => /^Q\d+$/.test(t));
  cache.searches[q] = ids;
  return ids;
}

interface ApiEntity {
  missing?: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  sitelinks?: Record<string, { title: string }>;
}

export async function getLabels(
  cache: Cache,
  ids: string[],
  refresh: boolean,
): Promise<Record<string, LabelRecord | null>> {
  const need = ids.filter((id) => refresh || !(id in cache.labels));
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50);
    stats.entities++;
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels|aliases|sitelinks",
      languages: "en|mul",
      sitefilter: "enwiki",
      format: "json",
      maxlag: "5",
    });
    const body = await fetchJson<{ entities: Record<string, ApiEntity> }>(
      `${API}?${params}`,
    );
    for (const id of batch) {
      const e = body.entities[id];
      if (!e || e.missing !== undefined) {
        cache.labels[id] = null;
        continue;
      }
      cache.labels[id] = {
        label: e.labels?.en?.value ?? e.labels?.mul?.value ?? null,
        aliases: [...(e.aliases?.en ?? []), ...(e.aliases?.mul ?? [])].map(
          (a) => a.value,
        ),
        enwiki: e.sitelinks?.enwiki?.title ?? null,
      };
    }
  }
  return Object.fromEntries(ids.map((id) => [id, cache.labels[id] ?? null]));
}

type Binding = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Binding[]> {
  stats.sparql++;
  const body = await fetchJson<{ results: { bindings: Binding[] } }>(SPARQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: new URLSearchParams({ query }).toString(),
  });
  return body.results.bindings;
}

const ENTITY = "http://www.wikidata.org/entity/";
const qid = (v: string | undefined) => (v ? v.replace(ENTITY, "") : null);
const rankOf = (v: string | undefined): Rank =>
  v?.endsWith("PreferredRank")
    ? "preferred"
    : v?.endsWith("DeprecatedRank")
      ? "deprecated"
      : "normal";

/** Subclass-of* closure for a root class, cached. */
export async function getSubclasses(
  cache: Cache,
  root: string,
  refresh: boolean,
): Promise<Set<string>> {
  if (refresh || !cache.classes[root]) {
    const rows = await sparql(`SELECT ?c WHERE { ?c wdt:P279* wd:${root} }`);
    cache.classes[root] = rows.map((r) => qid(r.c?.value)!).filter(Boolean);
  }
  return new Set(cache.classes[root]);
}

function detailsQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const simple = (p: string) =>
    `{ ?item p:${p} ?st . ?st ps:${p} ?v ; wikibase:rank ?rank . BIND("${p}" AS ?p) }`;
  const people = (p: string) =>
    `{ ?item wdt:${p} ?person . ?person rdfs:label ?v . FILTER(LANG(?v) IN ("en", "mul")) BIND("${p}" AS ?p) }`;
  return `SELECT ?item ?p ?st ?v ?rank ?by ?method ?date ?role ?lang ?dur ?vtitle WHERE {
  VALUES ?item { ${values} }
  ${simple("P31")} UNION ${simple("P577")} UNION ${simple("P580")} UNION ${simple("P345")} UNION ${simple("P1258")}
  UNION ${people("P57")} UNION ${people("P161")}
  UNION { ?item p:P444 ?st . ?st ps:P444 ?v ; wikibase:rank ?rank ; pq:P447 ?by .
          FILTER(?by IN (wd:Q105584, wd:Q150248))
          OPTIONAL { ?st pq:P459 ?method } OPTIONAL { ?st pq:P585 ?date } BIND("P444" AS ?p) }
  UNION { ?item p:P1651 ?st . ?st ps:P1651 ?v ; wikibase:rank ?rank .
          OPTIONAL { ?st pq:P3831 ?role } OPTIONAL { ?st pq:P407 ?lang } OPTIONAL { ?st pq:P585 ?date }
          OPTIONAL { ?st pqn:P2047/wikibase:quantityAmount ?dur } OPTIONAL { ?st pq:P1476 ?vtitle }
          BIND("P1651" AS ?p) }
}`;
}

/** Full candidate records for title-matching QIDs (claims via SPARQL, labels from getLabels). */
export async function getDetails(
  cache: Cache,
  ids: string[],
  refresh: boolean,
): Promise<Record<string, WdCandidate | null>> {
  const need = ids.filter((id) => refresh || !(id in cache.details));
  for (let i = 0; i < need.length; i += 25) {
    const batch = need.slice(i, i + 25);
    const rows = await sparql(detailsQuery(batch));
    const labels = await getLabels(cache, batch, false);
    const recs = new Map<string, WdCandidate>();
    // Statement URIs dedupe rows multiplied by OPTIONAL qualifiers.
    const seen = new Set<string>();
    for (const id of batch) {
      const l = labels[id];
      recs.set(id, {
        id,
        label: l?.label ?? null,
        aliases: l?.aliases ?? [],
        enwiki: l?.enwiki ?? null,
        p31: [],
        dates: [],
        directors: [],
        cast: [],
        imdb: [],
        rottenTomatoes: [],
        scores: [],
        videos: [],
      });
    }
    for (const r of rows) {
      const rec = recs.get(qid(r.item?.value) ?? "");
      const p = r.p?.value;
      const v = r.v?.value;
      if (!rec || !p || v === undefined) continue;
      const key = `${rec.id}|${p}|${r.st?.value ?? v}`;
      if (p !== "P57" && p !== "P161" && seen.has(key)) continue;
      seen.add(key);
      const rank = rankOf(r.rank?.value);
      const base: WdValue = { value: v, rank };
      switch (p) {
        case "P31":
          if (rank !== "deprecated") rec.p31.push(qid(v)!);
          break;
        case "P577":
        case "P580":
          if (rank !== "deprecated") rec.dates.push(v);
          break;
        case "P345":
          rec.imdb.push(base);
          break;
        case "P1258":
          rec.rottenTomatoes.push(base);
          break;
        case "P57":
          if (!rec.directors.includes(v)) rec.directors.push(v);
          break;
        case "P161":
          if (!rec.cast.includes(v)) rec.cast.push(v);
          break;
        case "P444":
          rec.scores.push({
            ...base,
            by: qid(r.by?.value)!,
            method: qid(r.method?.value),
            date: r.date?.value ?? null,
          } satisfies WdReviewScore);
          break;
        case "P1651":
          rec.videos.push({
            ...base,
            role: qid(r.role?.value),
            lang: qid(r.lang?.value),
            date: r.date?.value ?? null,
            seconds: r.dur ? Math.round(parseFloat(r.dur.value)) : null,
            title: r.vtitle?.value ?? null,
          } satisfies WdVideo);
          break;
      }
    }
    for (const [id, rec] of recs) cache.details[id] = labels[id] ? rec : null;
  }
  return Object.fromEntries(ids.map((id) => [id, cache.details[id] ?? null]));
}

// ---------- OMDb ----------

/** Set on a quota/key error: no more OMDb calls this run, and nothing cached for them. */
let omdbDisabled = false;
const OMDB_FATAL = /limit reached|api key|HTTP 401/i;

function disableOmdb(reason: string) {
  if (!omdbDisabled) console.error(`! OMDb disabled for this run: ${reason}`);
  omdbDisabled = true;
}

/** OMDb by IMDb ID only (never by title, to avoid introducing new false matches). */
export async function getOmdb(
  cache: Cache,
  apiKey: string,
  imdbId: string,
  refresh: boolean,
): Promise<OmdbRecord | null> {
  if (!refresh && imdbId in cache.omdb) return cache.omdb[imdbId];
  if (omdbDisabled) return cache.omdb[imdbId] ?? null;
  stats.omdb++;
  const params = new URLSearchParams({ i: imdbId, apikey: apiKey });
  let body: {
    Response: string;
    Error?: string;
    imdbRating?: string;
    Metascore?: string;
    Ratings?: { Source: string; Value: string }[];
  };
  try {
    body = await fetchJson(`https://www.omdbapi.com/?${params}`);
  } catch (e) {
    // OMDb answers a bad key or spent quota with HTTP 401.
    if (OMDB_FATAL.test((e as Error).message)) {
      disableOmdb((e as Error).message.slice(0, 120));
      return cache.omdb[imdbId] ?? null;
    }
    throw e;
  }
  if (body.Response !== "True") {
    const err = body.Error ?? "";
    if (OMDB_FATAL.test(err)) disableOmdb(err);
    // Only a genuine miss is cached; anything else may work next run.
    else if (/not found|incorrect imdb id/i.test(err)) cache.omdb[imdbId] = null;
    return cache.omdb[imdbId] ?? null;
  }
  const num = (s: string | undefined) =>
    s && !Number.isNaN(parseFloat(s)) ? parseFloat(s) : null;
  const rt = body.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
  const rec: OmdbRecord = {
    imdbRating: num(body.imdbRating),
    rottenTomatoes: rt?.endsWith("%") ? num(rt) : null,
    metascore: num(body.Metascore),
  };
  cache.omdb[imdbId] = rec;
  return rec;
}
