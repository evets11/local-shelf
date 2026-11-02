import type { FilmExtras } from "@/lib/types";
import { imdbUrl, rottenTomatoesUrl } from "@/lib/format";

/** IMDb / Rotten Tomatoes / Metacritic chips. Links even when we have no score. */
export function Ratings({ extras: x }: { extras?: FilmExtras | null }) {
  if (!x || (!x.imdbId && !x.rottenTomatoesId && x.metacriticScore === null))
    return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {x.imdbId && (
        <a
          href={imdbUrl(x.imdbId)}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#f5c518] px-2 py-1 text-xs font-bold text-black hover:brightness-95"
        >
          IMDb
          {x.imdbRating !== null && (
            <span className="font-semibold">★ {x.imdbRating.toFixed(1)}</span>
          )}
        </a>
      )}
      {x.rottenTomatoesId && (
        <a
          href={rottenTomatoesUrl(x.rottenTomatoesId)}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-xs font-semibold text-ink hover:border-coral"
          title="Rotten Tomatoes Tomatometer"
        >
          <span aria-hidden>
            {x.rottenTomatoesScore !== null && x.rottenTomatoesScore < 60
              ? "🤢"
              : "🍅"}
          </span>
          {x.rottenTomatoesScore !== null
            ? `${x.rottenTomatoesScore}%`
            : "Rotten Tomatoes"}
        </a>
      )}
      {x.metacriticScore !== null && (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-white ${
            x.metacriticScore >= 61
              ? "bg-emerald-600"
              : x.metacriticScore >= 40
                ? "bg-amber-500"
                : "bg-red-600"
          }`}
          title="Metacritic Metascore"
        >
          Metacritic {x.metacriticScore}
        </span>
      )}
      {x.wikipediaUrl && (
        <a
          href={x.wikipediaUrl}
          target="_blank"
          rel="noopener"
          className="text-xs text-muted underline hover:text-ink"
        >
          Wikipedia
        </a>
      )}
    </div>
  );
}
