"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { FeatureTitle } from "@/lib/card";
import { CERT_STYLES, isEItem, tidySummary } from "@/lib/format";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import { Poster } from "./Poster";
import { MyListButton } from "./MyListButton";
import { Ratings } from "./Ratings";

/** Full-bleed featured picks at the top of a home page, filtered by profile and library prefs. Manual only: no auto-advance. */
export function FeaturedCarousel({
  items,
  intro,
}: {
  items: FeatureTitle[];
  intro: string;
}) {
  const prefs = usePrefs();
  const visible = items.filter((t) => matchesPrefs(t, prefs));
  const [index, setIndex] = useState(0);
  const count = visible.length;

  if (count === 0) return null;
  const current = index % count;
  const t = visible[current];
  const go = (d: number) =>
    setIndex((i) => (((i + d) % count) + count) % count);

  return (
    <section
      data-pref-filtered
      aria-roledescription="carousel"
      aria-label="Featured picks"
      className="relative overflow-hidden bg-hero text-white"
    >
      {t.poster && (
        // Cover art blown up and blurred into the backdrop. Plain <img> since art is hot-linked.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`bg-${t.irn}`}
          src={t.poster}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          className="animate-fade-in absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-hero via-hero/75 to-hero/10" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-paper to-transparent" />

      <div
        key={t.irn}
        role="group"
        aria-roledescription="slide"
        aria-label={`${current + 1} of ${count}: ${t.title}`}
        className="animate-fade-in relative mx-auto flex max-w-[1800px] items-start gap-4 px-4 pb-20 pt-5 sm:items-center sm:gap-12 sm:px-8 sm:pb-28 sm:pt-14 lg:min-h-[34rem]"
      >
        <Link
          href={`/title/${t.irn}`}
          scroll={false}
          className="w-28 shrink-0 transition-transform duration-300 hover:-rotate-1 hover:scale-[1.02] sm:w-60 lg:w-80"
          aria-label={`More about ${t.title}`}
        >
          <Poster
            src={t.poster}
            title={t.title}
            year={t.year}
            eager
            className="rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
          />
        </Link>
        <div className="min-w-0 max-w-2xl space-y-3 sm:space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            {intro}
          </p>
          <h2 className="font-display text-3xl font-semibold leading-[1.05] drop-shadow-lg sm:text-6xl lg:text-7xl">
            {t.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            {t.certificate && (
              <span
                className={`rounded px-1.5 text-xs font-bold leading-5 ${CERT_STYLES[t.certificate] ?? "bg-slate-500 text-white"}`}
              >
                {t.certificate}
              </span>
            )}
            {t.byline && (
              <span className="font-medium text-white">{t.byline}</span>
            )}
            {t.meta.map((m) => (
              <span key={m}>· {m}</span>
            ))}
          </div>
          {t.summary && (
            <p className="line-clamp-3 text-sm text-white/90 sm:line-clamp-4 sm:text-lg">
              {tidySummary(t.summary)}
            </p>
          )}
          <div className="[&_a]:border-white/30 [&_a]:bg-white/95 [&_a]:text-black">
            <Ratings extras={t.extras} />
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
            <span aria-hidden className={`h-2 w-2 rounded-full ${t.available > 0 || isEItem(t) ? "bg-emerald-400" : "bg-white/50"}`} />
            {t.availability}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={`/title/${t.irn}`}
              scroll={false}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/85"
            >
              Take a look <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="[&_button]:border-white/40 [&_button]:bg-white/10 [&_button]:py-3 [&_button]:text-white">
              <MyListButton irn={t.irn} />
            </div>
          </div>
        </div>
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-8 mx-auto flex max-w-[1800px] items-center gap-3 px-4 sm:bottom-12 sm:px-8">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous pick"
            className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-1.5">
            {visible.map((v, i) => (
              <button
                key={v.irn}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show pick ${i + 1}: ${v.title}`}
                aria-current={i === current}
                className={`h-2 rounded-full transition-all ${i === current ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next pick"
            className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </section>
  );
}
