"use client";

import MiniSearch from "minisearch";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { SearchTitle } from "@/lib/card";
import type { Kind } from "@/lib/types";
import { matchesPrefs, usePrefs } from "@/lib/prefs";
import { TitleGrid } from "./TitleGrid";
import { LibraryResults } from "./LibraryResults";
import {
  DECADES,
  DECADE_LABELS,
  matchesFormatAndDecade,
  type Filters,
} from "@/lib/filters";

const CERTS = ["U", "PG", "12", "12A", "15", "18"];
const PAGE = 60;

type SortKey = "relevance" | "new" | "az" | "year" | "critics";

interface Props {
  kind: Kind;
  titles: SearchTitle[];
  heading: string;
  /** Books/audiobooks only index recent additions, so point people at the full catalogue. */
  partial?: boolean;
}

export function Explorer({ kind, titles, heading, partial = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [limit, setLimit] = useState(PAGE);
  const isFilm = kind === "film";
  const prefs = usePrefs();

  const q = params.get("q")?.trim() ?? "";
  // New query (e.g. typed in the header) starts paging again from the top.
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setLimit(PAGE);
  }
  // Library and on-shelf default to the saved preferences; changing them here overrides
  // for this view only (via the URL), so the controls always show what's applied.
  const filters: Filters = {
    available: params.has("available")
      ? params.get("available") === "1"
      : prefs.onShelfOnly,
    branch: params.has("branch") ? (params.get("branch") ?? "") : prefs.branch,
    genre: params.get("genre") ?? "",
    cert: params.get("cert") ?? "",
    decade: params.get("decade") ?? "",
    language: params.get("language") ?? "",
    audience: params.get("audience") ?? "",
    format: params.get("format") ?? "",
  };
  // Only honour sorts the select actually offers here, so the UI and the order always agree.
  const offered: SortKey[] = [
    ...(q ? (["relevance"] as const) : []),
    "new",
    "year",
    "az",
    ...(isFilm ? (["critics"] as const) : []),
  ];
  const requested = params.get("sort") as SortKey | null;
  const sort: SortKey =
    requested && offered.includes(requested)
      ? requested
      : q
        ? "relevance"
        : "new";

  // Indexing thousands of titles is only worth it once someone actually searches.
  const hasQuery = q !== "";
  const index = useMemo(() => {
    if (!hasQuery) return null;
    const ms = new MiniSearch<SearchTitle>({
      idField: "irn",
      fields: ["title", "people", "genres"],
      extractField: (doc, field) => {
        const v = doc[field as keyof SearchTitle];
        return Array.isArray(v) ? v.join(" ") : String(v ?? "");
      },
      searchOptions: {
        boost: { title: 3, people: 2 },
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
        combineWith: "AND",
      },
    });
    ms.addAll(titles);
    return ms;
  }, [titles, hasQuery]);

  const byIrn = useMemo(() => new Map(titles.map((t) => [t.irn, t])), [titles]);

  const options = useMemo(() => {
    const count = (pick: (t: SearchTitle) => string[]) => {
      const m = new Map<string, number>();
      for (const t of titles)
        for (const v of pick(t)) m.set(v, (m.get(v) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    };
    return {
      branches: count((t) => t.branches),
      genres: count((t) => t.genres),
      languages: count((t) => t.languages).slice(0, 25),
      formats: count((t) => [t.format]),
    };
  }, [titles]);

  const matched = useMemo(
    () =>
      q && index
        ? index.search(q).map((r) => byIrn.get(r.id as string)!)
        : titles,
    [q, index, byIrn, titles],
  );
  // Every local match, filtered or not, so filtered-out titles don't resurface in the live
  // section (which can't apply every filter).
  const shownElsewhere = useMemo(
    () => new Set(matched.map((t) => t.irn)),
    [matched],
  );

  const results = useMemo(() => {
    let list = matched.filter((t) => {
      if (
        !matchesPrefs(t, {
          ...prefs,
          branch: filters.branch,
          onShelfOnly: filters.available,
        })
      )
        return false;
      if (filters.genre && !t.genres.includes(filters.genre)) return false;
      if (filters.cert && t.certificate !== filters.cert) return false;
      if (filters.language && !t.languages.includes(filters.language))
        return false;
      if (filters.audience && t.audience !== filters.audience) return false;
      return matchesFormatAndDecade(t, filters);
    });
    if (sort === "new") {
      list = [...list].sort(
        (a, b) =>
          // Prize books kept from the backlist aren't new to the library.
          Number(Boolean(a.pinned)) - Number(Boolean(b.pinned)) ||
          b.firstSeen.localeCompare(a.firstSeen) ||
          (b.year ?? 0) - (a.year ?? 0),
      );
    } else if (sort === "az") {
      list = [...list].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
    } else if (sort === "year") {
      list = [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    } else if (sort === "critics") {
      list = [...list].sort((a, b) => (b.rtScore ?? -1) - (a.rtScore ?? -1));
    }
    return list;
    // filters is rebuilt each render from params; params is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, params, sort, prefs]);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    // These two override saved prefs, so an explicit "" / "0" must survive in the URL.
    if (value || key === "branch" || key === "available") next.set(key, value);
    else next.delete(key);
    setLimit(PAGE);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeCount = [...params.keys()].filter(
    (k) => k !== "q" && k !== "sort",
  ).length;

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">
            {q ? <>Results for &ldquo;{q}&rdquo;</> : heading}
          </h1>
          <p className="text-sm text-muted">
            <span aria-live="polite">
              {results.length.toLocaleString("en-GB")}{" "}
              {results.length === 1 ? "title" : "titles"}
              {partial && q.length >= 3 && " among the newest"}
            </span>
            {partial && q.length >= 3 && results.length > 0 && (
              <>
                {" "}
                ·{" "}
                <a
                  href="#library-results"
                  className="font-medium text-sea underline-offset-2 hover:underline"
                >
                  More from the whole catalogue
                </a>
              </>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => set("sort", e.target.value)}
            className={selectCls}
          >
            {q && <option value="relevance">Best match</option>}
            <option value="new">Newest to the library</option>
            <option value="year">
              {isFilm ? "Release year" : "Publication year"}
            </option>
            <option value="az">A to Z</option>
            {isFilm && <option value="critics">Critics&apos; score</option>}
          </select>
        </label>
      </div>

      <div className="no-scrollbar -mx-4 mb-6 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
        <button
          type="button"
          onClick={() => set("available", filters.available ? "0" : "1")}
          aria-pressed={filters.available}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            filters.available
              ? "border-sea bg-sea text-on-sea"
              : "border-line bg-card hover:border-sea"
          }`}
        >
          On the shelf now
        </button>
        {(options.branches.length > 0 || filters.branch) && (
          <Select
            label="Library"
            value={filters.branch}
            onChange={(v) => set("branch", v)}
            // A saved library with nothing here must still show as applied.
            options={
              filters.branch && !options.branches.includes(filters.branch)
                ? [filters.branch, ...options.branches]
                : options.branches
            }
          />
        )}
        <Select
          label="Genre"
          value={filters.genre}
          onChange={(v) => set("genre", v)}
          options={options.genres}
        />
        <Select
          label="Decade"
          value={filters.decade}
          onChange={(v) => set("decade", v)}
          options={Object.keys(DECADES)}
          labels={DECADE_LABELS}
        />
        {options.languages.length > 1 && (
          <Select
            label="Language"
            value={filters.language}
            onChange={(v) => set("language", v)}
            options={options.languages}
          />
        )}
        {options.formats.length > 1 && kind !== "audiobook" && (
          <Select
            label="Format"
            value={filters.format}
            onChange={(v) => set("format", v)}
            options={options.formats}
          />
        )}
        {prefs.profile !== "kids" && (
          <Select
            label="Audience"
            value={filters.audience}
            onChange={(v) => set("audience", v)}
            options={["children", "adult"]}
            labels={{
              children: isFilm ? "Kids & family" : "Children's",
              adult: "Grown-ups",
            }}
          />
        )}
        {isFilm && (
          <div className="flex gap-1" role="group" aria-label="Certificate">
            {CERTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={filters.cert === c}
                onClick={() => set("cert", filters.cert === c ? "" : c)}
                className={`h-8 min-w-8 rounded-md border px-1.5 text-xs font-bold transition ${
                  filters.cert === c
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-card hover:border-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              router.replace(
                q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname,
                { scroll: false },
              )
            }
            className="text-sm text-muted underline hover:text-ink"
          >
            {prefs.branch || prefs.onShelfOnly
              ? "Reset to my settings"
              : "Clear filters"}
          </button>
        )}
      </div>

      {prefs.profile === "kids" && (
        <p className="mb-4 text-sm text-muted" role="status">
          <span className="font-semibold text-sea">Kids profile:</span> only
          children&apos;s titles are shown.
        </p>
      )}

      {partial && !q && (
        <p className="mb-6 rounded-lg border border-line bg-card px-4 py-3 text-sm text-muted">
          Browsing shows the library&apos;s newest{" "}
          {kind === "book" ? "books" : "audiobooks"}.{" "}
          <strong className="font-semibold text-ink">
            Search covers the whole catalogue.
          </strong>
        </p>
      )}

      {titles.length === 0 ? (
        <div className="py-20 text-center text-muted">
          <p className="font-display text-2xl text-ink">
            Stocking the shelves…
          </p>
          <p className="text-sm">
            This collection hasn&apos;t been synced yet. Check back soon.
          </p>
        </div>
      ) : results.length === 0 ? (
        partial && q ? (
          <p className="text-sm text-muted">
            {q.trim().length >= 3
              ? "Nothing among the newest titles. Checking the whole catalogue below."
              : "Nothing among the newest titles. Type at least 3 letters to search the whole catalogue."}
          </p>
        ) : (
          <div className="py-20 text-center text-muted">
            <p className="font-display text-2xl text-ink">Nothing matched.</p>
            <p className="text-sm">Try fewer words, or clear some filters.</p>
          </div>
        )
      ) : (
        <>
          <TitleGrid items={results.slice(0, limit)} />
          {results.length > limit && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE * 2)}
                className="rounded-full border border-line bg-card px-6 py-2.5 font-semibold hover:border-sea hover:text-sea"
              >
                Show more ({(results.length - limit).toLocaleString("en-GB")}{" "}
                left)
              </button>
            </div>
          )}
        </>
      )}

      {kind !== "film" && q && (
        <LibraryResults
          kind={kind}
          q={q}
          exclude={shownElsewhere}
          filters={filters}
        />
      )}
    </div>
  );
}

const selectCls =
  "h-8 rounded-full border border-line bg-card px-3 text-sm text-ink outline-none focus:border-sea focus-visible:ring-2 focus-visible:ring-sea/30";

function Select({
  label,
  value,
  onChange,
  options,
  labels = {},
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${selectCls} ${value ? "border-sea bg-sea/10 font-medium text-sea" : ""}`}
    >
      <option value="">{label}: any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] ?? o}
        </option>
      ))}
    </select>
  );
}
