// Enrich films with Wikidata (and optionally OMDb) IDs, scores and trailers.
//
//   npm run enrich [-- --limit N] [--refresh] [--rematch] [--only IRN,IRN] [--verbose]
//
// --refresh  ignore cached network lookups (refetch everything processed)
// --rematch  re-run matching on every title using cached lookups only where present
// Env: OMDB_API_KEY (optional) fills imdbRating and missing RT/Metacritic scores.
//
// Writes data/film-extras.json (confident matches only) and data/wikidata-cache.json.
import { readFileSync } from "node:fs";
import { pool } from "../src/lib/concurrency";
import { join } from "node:path";
import type { Catalog, FilmExtras, Title } from "../src/lib/types";
import {
  buildExtras,
  chooseMatch,
  classify,
  evaluateCandidate,
  castKey,
  fingerprint,
  needsMatch,
  normaliseTitle,
  parseCatalogueTitle,
  titleVariants,
  type Evaluation,
  type VariantKind,
} from "../src/lib/enrich/match";
import {
  getDetails,
  getLabels,
  getOmdb,
  getSubclasses,
  loadCache,
  searchEntities,
  stats,
  writeJsonAtomic,
  type Cache,
} from "../src/lib/enrich/wikidata";

const DATA = join(process.cwd(), "data");
const CATALOG = join(DATA, "catalog-films.json");
const CACHE = join(DATA, "wikidata-cache.json");
const OUT = join(DATA, "film-extras.json");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const refresh = flag("--refresh");
const rematch = flag("--rematch") || refresh;
const verbose = flag("--verbose");
const limit = opt("--limit") ? parseInt(opt("--limit")!, 10) : Infinity;
const only = opt("--only")?.split(",");

// The sync writes catalogs atomically (temp file + rename), so reads are never torn.
async function readCatalog(): Promise<Title[]> {
  return (JSON.parse(readFileSync(CATALOG, "utf8")) as Catalog).titles;
}

interface Classes {
  film: Set<string>;
  tv: Set<string>;
  other: Set<string>;
}

async function matchTitle(cache: Cache, classes: Classes, t: Title) {
  const parsed = parseCatalogueTitle(t.title);
  const variants = titleVariants(parsed);
  if (!variants.length)
    return { qid: null, via: null, score: 0, reason: "multi-title set" };

  const ids = new Set<string>();
  for (const v of variants)
    for (const id of await searchEntities(cache, v.text, refresh)) ids.add(id);
  const labels = await getLabels(cache, [...ids], refresh);

  const keys = new Set(variants.map((v) => normaliseTitle(v.text)));
  const titled = [...ids].filter((id) => {
    const l = labels[id];
    return (
      l && [l.label, ...l.aliases].some((n) => n && keys.has(normaliseTitle(n)))
    );
  });
  if (!titled.length)
    return {
      qid: null,
      via: null,
      score: 0,
      reason: `no title match in ${ids.size} hits`,
    };

  const details = await getDetails(cache, titled, refresh);
  const evals: Evaluation[] = [];
  for (const id of titled) {
    const c = details[id];
    if (!c) continue;
    const kind = classify(c.p31, classes.film, classes.tv, classes.other);
    for (const v of variants)
      evals.push(evaluateCandidate({ film: t, parsed, kind }, v, c));
  }
  if (verbose)
    for (const e of evals)
      if (e.reason !== "title differs")
        console.log(`   ${t.irn} ${e.id} ${e.via} ${e.score} ${e.reason}`);
  return chooseMatch(evals);
}

async function main() {
  const started = Date.now();
  const titles = await readCatalog();
  const cache = loadCache(CACHE);

  const [film, tv, episode, season] = await Promise.all(
    ["Q11424", "Q15416", "Q21191270", "Q3464665"].map((q) =>
      getSubclasses(cache, q, refresh),
    ),
  );
  const classes: Classes = {
    film,
    tv,
    other: new Set([...episode, ...season]),
  };

  const todo = titles
    .filter((t) => !only || only.includes(t.irn))
    .filter((t) => rematch || only || needsMatch(cache.decisions[t.irn], t))
    .slice(0, limit);
  console.log(
    `${titles.length} titles, ${todo.length} to process${refresh ? " (refresh)" : ""}`,
  );

  let done = 0;
  let matched = 0;
  await pool(todo, 4, async (t) => {
    try {
      const d = await matchTitle(cache, classes, t);
      cache.decisions[t.irn] = {
        fingerprint: fingerprint(t),
        ...d,
        ...(d.qid ? {} : { cast: castKey(t) }),
      };
      if (d.qid) matched++;
      if (verbose || d.qid)
        console.log(
          `${d.qid ? "✓" : "·"} ${t.irn} ${t.title} (${t.year}) -> ${d.qid ?? "-"} ${d.reason}`,
        );
    } catch (e) {
      // Leave undecided so the next run retries it.
      console.error(`! ${t.irn} ${t.title}: ${(e as Error).message}`);
    }
    if (++done % 50 === 0) {
      writeJsonAtomic(CACHE, cache);
      console.log(
        `-- ${done}/${todo.length}, ${matched} matched, ${JSON.stringify(stats)}`,
      );
    }
  });
  writeJsonAtomic(CACHE, cache);

  // Build output for every catalogue title with a confident decision.
  const omdbKey = process.env.OMDB_API_KEY;
  if (!omdbKey)
    console.log("OMDB_API_KEY not set; skipping OMDb (no imdbRating).");
  const out: Record<string, FilmExtras> = {};
  for (const t of [...titles].sort((a, b) =>
    a.irn.localeCompare(b.irn, "en", { numeric: true }),
  )) {
    const d = cache.decisions[t.irn];
    if (!d?.qid || d.fingerprint !== fingerprint(t)) continue;
    const c = cache.details[d.qid];
    if (!c) continue;
    // Series-level scores don't describe one season, so only full-title TV matches keep them.
    const kind = classify(c.p31, classes.film, classes.tv, classes.other);
    const via = (
      kind === "tv" && d.via !== "full" ? "series" : d.via
    ) as VariantKind;
    const x = buildExtras(c, via);
    if (omdbKey && x.imdbId) {
      try {
        const o = await getOmdb(cache, omdbKey, x.imdbId, refresh);
        if (o) {
          x.imdbRating = o.imdbRating;
          if (via !== "series") {
            x.rottenTomatoesScore ??= o.rottenTomatoes;
            x.metacriticScore ??= o.metascore;
          }
        }
      } catch (e) {
        console.error(`! OMDb ${x.imdbId}: ${(e as Error).message}`);
      }
    }
    out[t.irn] = x;
  }
  if (omdbKey) writeJsonAtomic(CACHE, cache);
  writeJsonAtomic(OUT, out);

  const n = Object.keys(out).length;
  const pct = (k: keyof FilmExtras) =>
    `${k} ${((Object.values(out).filter((x) => x[k] !== null).length / titles.length) * 100).toFixed(1)}%`;
  console.log(
    `\n${n}/${titles.length} titles enriched (${((n / titles.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    (
      [
        "imdbId",
        "rottenTomatoesId",
        "rottenTomatoesScore",
        "metacriticScore",
        "youtubeTrailerId",
        "wikipediaUrl",
        "imdbRating",
      ] as const
    )
      .map(pct)
      .join(", "),
  );
  console.log(
    `requests ${JSON.stringify(stats)}, ${((Date.now() - started) / 1000).toFixed(0)}s`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
