import Link from "next/link";
import type { CardTitle } from "@/lib/card";
import { isEItem } from "@/lib/format";
import { Poster } from "./Poster";


/** A cover with title and byline underneath, like a bookshop shelf card. */
export function TitleCard({
  t,
  eager,
  href = `/title/${t.irn}`,
}: {
  t: CardTitle;
  eager?: boolean;
  /** Override for results that aren't in our catalogue (full-catalogue search). */
  href?: string;
}) {
  const meta = [t.byline, t.year].filter(Boolean).join(" · ");
  return (
    <Link
      href={href}
      // Titles and catalogue items open as a sheet over this page, so keep the scroll position.
      scroll={href.startsWith("/title/") || href.startsWith("/item") ? false : undefined}
      className="group/card block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
      aria-label={`${t.title}${meta ? `, ${meta}` : ""}`}
    >
      <div className="relative shadow-sm transition duration-200 group-hover/card:-translate-y-1 group-hover/card:shadow-lg">
        <Poster src={t.poster} title={t.title} year={t.year} eager={eager} />
        <span
          className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isEItem(t)
              ? "bg-violet-600 text-white"
              : t.available > 0
                ? "bg-shelf text-on-shelf"
                : "bg-card/90 text-muted"
          }`}
        >
          {isEItem(t)
            ? "Borrow online"
            : t.available > 0
              ? "On the shelf"
              : t.onOrder
                ? "On order"
                : "Not on shelf"}
        </span>
        {t.rtScore !== null && (
          <span
            className="absolute right-1.5 top-1.5 rounded-full bg-card/95 px-1.5 py-0.5 text-[10px] font-bold text-ink shadow-sm"
            title="Rotten Tomatoes Tomatometer"
          >
            🍅 {t.rtScore}%
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover/card:text-sea">
        {t.title}
      </p>
      {meta && <p className="line-clamp-1 text-xs text-muted">{meta}</p>}
    </Link>
  );
}
