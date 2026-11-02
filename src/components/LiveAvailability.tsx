"use client";

import { useEffect, useState } from "react";
import type { Holding, LiveAvailability as Live } from "@/lib/types";
import { availabilityLabel, shortDate } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { Bone } from "./Skeleton";

interface Props {
  irn: string;
  /** Holdings from the last catalogue sync, shown until live data arrives. */
  initial: Holding[];
  /** Counts from the last sync (list page), used until live data arrives. */
  snapshot: { available: number; copies: number };
  /** Already-live holdings (full-catalogue records): show these and skip the fetch. */
  preloaded?: Live;
}

type State =
  { kind: "loading" } | { kind: "live"; data: Live } | { kind: "error" };

export function LiveAvailability({ irn, initial, snapshot, preloaded }: Props) {
  const [state, setState] = useState<State>(
    preloaded ? { kind: "live", data: preloaded } : { kind: "loading" },
  );

  useEffect(() => {
    if (preloaded) return;
    const ctrl = new AbortController();
    fetch(`/api/availability/${irn}`, { signal: ctrl.signal })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((data: Live) => setState({ kind: "live", data }))
      .catch((e) => {
        if (!ctrl.signal.aborted) {
          console.warn("[LibraryFlix] live availability failed", e);
          setState({ kind: "error" });
        }
      });
    return () => ctrl.abort();
  }, [irn, preloaded]);

  const live = state.kind === "live" ? state.data : null;
  const prefs = usePrefs();
  // Your library first; stable sort keeps the catalogue's order otherwise.
  const holdings = [...(live ? live.holdings : initial)].sort(
    (a, b) =>
      Number(b.branch === prefs.branch) - Number(a.branch === prefs.branch),
  );

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">
        Where to find it{" "}
        {state.kind === "loading" ? (
          <Bone className="ml-1 inline-block h-4 w-36 align-middle" />
        ) : (
          <span className="font-normal text-muted">
            · {availabilityLabel(live ?? snapshot)}
          </span>
        )}
      </h3>
      <div className="flex items-center gap-2 text-xs text-muted">
        {state.kind === "loading" && (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-muted" />{" "}
            Checking the shelves live…
          </>
        )}
        {state.kind === "live" && (
          <>
            <span className="h-2 w-2 rounded-full bg-sea" /> Live from the
            library catalogue
          </>
        )}
        {state.kind === "error" && (
          <>
            Couldn&apos;t reach the library just now. Showing last night&apos;s
            snapshot.
          </>
        )}
      </div>
      {holdings.length === 0 ? (
        <p className="text-sm text-muted">No copies listed.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {holdings.map((h, i) => (
            <li
              key={`${h.branch}-${i}`}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {h.branch}
                  {prefs.branch === h.branch && (
                    <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-coral">
                      Your library
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {h.subLocation && /store/i.test(h.subLocation)
                    ? "In the store room, ask staff"
                    : h.collection}
                </p>
              </div>
              {/* Last night's status could be stale, so it waits for the live check. */}
              {state.kind === "loading" ? (
                <Bone className="h-5 w-24 shrink-0 rounded-full" />
              ) : (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    h.available ? "bg-sea/10 text-sea" : "bg-paper-2 text-muted"
                  }`}
                >
                  {h.available
                    ? h.subLocation && /store/i.test(h.subLocation)
                      ? "Available"
                      : "On the shelf"
                    : h.dueDate
                      ? `Due back ${shortDate(h.dueDate)}`
                      : statusText(h.status)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Raw Spydus statuses (possibly several joined by "; ") mapped to plain English, first match wins.
const STATUS_LABELS: [RegExp, string][] = [
  [/In-transit/i, "In transit"],
  [/On reserve shelf/i, "Reserved for someone"],
  [/Reservation Allocation/i, "Reserved for someone"],
  [/On order/i, "On order"],
  [/Physical Processing/i, "Being processed"],
  [/Being repaired/i, "Being repaired"],
  [/Missing/i, "Missing"],
  // Last: stacked statuses like "AV item (...); In-transit ..." should match the specific one.
  [/AV item/i, "Not on the shelf"],
];

function statusText(status: string) {
  for (const [re, label] of STATUS_LABELS) if (re.test(status)) return label;
  // "Something (Set: 29 May 2026)" -> "Something"
  return status.replace(/\s*\(Set:.*\)$/, "") || "Unavailable";
}
