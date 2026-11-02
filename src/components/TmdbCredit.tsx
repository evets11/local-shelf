/**
 * TMDB's required attribution: their logo plus their exact disclaimer wording
 * (themoviedb.org/api-terms-of-use). Used in the footer and on the About page.
 */
export function TmdbCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <a
        href="https://www.themoviedb.org/"
        aria-label="The Movie Database (TMDB)"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/credits/tmdb.svg"
          alt=""
          width={110}
          height={14}
          className="h-3.5 w-auto"
        />
      </a>
      <span>
        Film posters and trailers from TMDB. This product uses TMDB and the TMDB
        APIs but is not endorsed, certified, or otherwise approved by TMDB.
      </span>
    </p>
  );
}
