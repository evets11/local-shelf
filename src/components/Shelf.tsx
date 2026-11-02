"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CardTitle } from "@/lib/card";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import { TitleCard } from "./TitleCard";

interface Props {
  title: string;
  href?: string;
  items: CardTitle[];
  eager?: boolean;
  /** Extra-large covers, for the standout row on a home page. */
  jumbo?: boolean;
}

/** A horizontally scrolling row of covers with paging arrows on desktop. */
export function Shelf({ items, ...rest }: Props) {
  const prefs = usePrefs();
  const visible = items.filter((t) => matchesPrefs(t, prefs)).slice(0, 30);
  return <ShelfRow {...rest} items={visible.map((t) => ({ t }))} />;
}

interface RowProps extends Omit<Props, "items"> {
  /** Already filtered by prefs. `label` sits above the title (e.g. "Shortlisted"). */
  items: { t: CardTitle; label?: string }[];
  /** Section id, for in-page links. */
  id?: string;
  /** A line under the heading. */
  description?: React.ReactNode;
}

/** The row itself, for callers that choose their own cards (e.g. one format per prize book). */
export function ShelfRow({ title, href, items: visible, eager, jumbo = false, id, description }: RowProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // Re-measure when filtering changes how many covers there are.
  }, [visible.length]);


  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el)
      el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  if (visible.length === 0) return null;

  return (
    <section data-pref-filtered className="relative scroll-mt-20" aria-label={title} id={id}>
      <div className="mb-1 flex items-end justify-between gap-4 px-4 sm:px-8">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">
            {title}
          </h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {href && (
            <Link
              href={href}
              className="flex items-center gap-1 text-sm font-medium text-sea hover:text-sea-dark"
            >
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <div className="hidden gap-1 sm:flex">
            <ArrowButton
              label={`Scroll ${title} left`}
              disabled={!canLeft}
              onClick={() => page(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </ArrowButton>
            <ArrowButton
              label={`Scroll ${title} right`}
              disabled={!canRight}
              onClick={() => page(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </ArrowButton>
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 pb-2 pt-3 sm:scroll-px-8 sm:gap-4 sm:px-8"
      >
        {visible.map(({ t, label }, i) => (
          <div
            key={t.irn}
            className="shrink-0 snap-start"
            style={{ width: jumbo ? "calc(var(--card-w) * 1.45)" : "var(--card-w)" }}
          >
            <TitleCard t={t} eager={eager && i < 8} label={label} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card text-ink transition hover:border-sea hover:text-sea disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink"
    >
      {children}
    </button>
  );
}
