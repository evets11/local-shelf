"use client";

import { CardGridSkeleton } from "./Skeleton";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CardTitle } from "@/lib/card";
import { MODES } from "@/lib/modes";
import { useMyList } from "@/lib/my-list";
import { TitleGrid } from "./TitleGrid";

type Loaded = { key: string; cards: CardTitle[]; offline: boolean } | { key: string; failed: true };

export function MyListView() {
  const { list, toggle } = useMyList();
  // Matches MAX_IDS in /api/cards; anything past it is never reported as gone.
  const requested = list.slice(0, 1000);
  const key = requested.join(",");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/cards?ids=${key}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        // Rebuilt offline by the service worker from cards it has seen: may be partial.
        const offline = r.headers.get("X-Shelf-Offline") === "1";
        setLoaded({ key, cards: (await r.json()) as CardTitle[], offline });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoaded({ key, failed: true });
      });
    return () => ctrl.abort();
  }, [key]);

  // Results for an older list stay on screen while the new one loads (e.g. after un-saving).
  const cards = loaded && "cards" in loaded ? loaded.cards : null;
  const byIrn = useMemo(() => new Map((cards ?? []).map((t) => [t.irn, t])), [cards]);
  const items = list.map((irn) => byIrn.get(irn)).filter((t): t is CardTitle => Boolean(t));
  // Only judge "gone" against a response for the current list.
  // Offline copies only hold cards seen before, so a missing one isn't necessarily gone.
  const gone =
    loaded?.key === key && cards && !("offline" in loaded && loaded.offline)
      ? requested.filter((irn) => !byIrn.has(irn))
      : [];

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-8">
      <h1 className="font-display text-4xl font-semibold">My List</h1>
      <p className="mb-8 text-sm text-muted">
        Saved on this device only. To borrow something, reserve it on the library site or pop in.
      </p>
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card p-10 text-center text-muted">
          <p className="font-display text-2xl text-ink">Nothing saved yet.</p>
          <p className="mt-1 text-sm">
            Hit <span className="font-semibold text-ink">Save</span> on anything you fancy.{" "}
            <Link href="/" className="text-sea underline">
              Start browsing
            </Link>
          </p>
        </div>
      ) : loaded && "failed" in loaded ? (
        <p className="text-muted">Couldn&apos;t load your list just now. Try refreshing.</p>
      ) : !cards ? (
        <CardGridSkeleton count={Math.min(list.length, 12)} label="Loading your list" />
      ) : (
        <div className="space-y-10">
          {gone.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-3 text-sm">
              <p>
                {gone.length === 1 ? "1 saved title isn't" : `${gone.length} saved titles aren't`} in Local Shelf any more.
                Books and audiobooks drop out as newer ones arrive, so the library may still have{" "}
                {gone.length === 1 ? "it" : "them"}.
              </p>
              <button
                type="button"
                onClick={() => gone.forEach(toggle)}
                className="rounded-full border border-line px-3 py-1 font-semibold hover:border-sea hover:text-sea"
              >
                Remove {gone.length === 1 ? "it" : "them"}
              </button>
            </div>
          )}
          {MODES.map((m) => {
            const mine = items.filter((t) => t.kind === m.kind);
            if (!mine.length) return null;
            return (
              <section key={m.kind}>
                <h2 className="mb-4 font-display text-2xl font-semibold">{m.label}</h2>
                <TitleGrid items={mine} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
