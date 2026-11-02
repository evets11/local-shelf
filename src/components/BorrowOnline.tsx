"use client";

import { useEffect, useState } from "react";
import type { EloanStatus, Title } from "@/lib/types";
import { shortDate } from "@/lib/format";
import {
  borrowBoxIdFromCover,
  eloanLinks,
  LIBRARY_LINKS,
} from "@/lib/spydus/urls";
import { Bone } from "./Skeleton";

type Props = Pick<Title, "title" | "format" | "isbn" | "coverUrl"> & {
  author: string | null;
};

type State =
  { kind: "loading" } | { kind: "done"; data: EloanStatus } | { kind: "error" };

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? "bg-shelf/12 text-shelf" : "bg-paper-2 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/** e-items: where to borrow them, with live BorrowBox and Libby status. */
export function BorrowOnline({ title, format, isbn, coverUrl, author }: Props) {
  const bb = borrowBoxIdFromCover(coverUrl);
  const type = format === "eBook" ? "ebook" : "audiobook";
  const query = new URLSearchParams({
    type,
    title,
    ...(bb && { bb }),
    ...(isbn && { isbn }),
    ...(author && { author }),
  });
  const key = query.toString();
  const [state, setState] = useState<{ key: string; s: State } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/eloan?${key}`, { signal: ctrl.signal })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((data: EloanStatus) => setState({ key, s: { kind: "done", data } }))
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ key, s: { kind: "error" } });
      });
    return () => ctrl.abort();
  }, [key]);

  const s: State = state?.key === key ? state.s : { kind: "loading" };
  const live = s.kind === "done" ? s.data : null;
  const bbStatus = live?.borrowBox;
  const libby = live?.libby;
  const libbyHref = libby
    ? eloanLinks.libbyTitle(libby.id)
    : eloanLinks.libbySearch([title, author].filter(Boolean).join(" "));

  return (
    <div className="space-y-3 rounded-lg border border-line p-4 text-sm">
      <h3 className="font-semibold">Borrow it online</h3>
      <p className="text-muted">
        This is a digital loan. Sign in with your library card on the
        library&apos;s apps.
      </p>
      <ul
        className="divide-y divide-line overflow-hidden rounded-md border border-line"
        aria-live="polite"
      >
        <li className="flex items-center justify-between gap-3 px-3 py-2">
          <a
            className="font-medium text-sea underline"
            href={bb ? eloanLinks.borrowBox(bb) : LIBRARY_LINKS.borrowBox}
            target="_blank"
            rel="noopener"
          >
            {bb ? "Open in BorrowBox" : "BorrowBox"}
          </a>
          {bb && s.kind === "loading" && (
            <Bone className="h-5 w-24 shrink-0 rounded-full" />
          )}
          {bbStatus?.available === true && <Pill ok>Available now</Pill>}
          {bbStatus?.available === false && (
            <Pill ok={false}>
              {bbStatus.nextAvailable
                ? `On loan, due back ${shortDate(bbStatus.nextAvailable)}`
                : "On loan"}
            </Pill>
          )}
        </li>
        <li className="flex items-center justify-between gap-3 px-3 py-2">
          <a
            className="font-medium text-sea underline"
            href={libbyHref}
            target="_blank"
            rel="noopener"
          >
            {libby ? "Open in Libby" : "Search Libby"}
          </a>
          {s.kind === "loading" && (
            <Bone className="h-5 w-24 shrink-0 rounded-full" />
          )}
          {libby?.available === true && <Pill ok>Available now</Pill>}
          {libby?.available === false && (
            <Pill ok={false}>
              {libby.waitDays
                ? `Waiting list, about ${libby.waitDays} days`
                : "Waiting list"}
            </Pill>
          )}
        </li>
      </ul>
      {s.kind === "done" && !libby && !live?.libbyFailed && (
        <p className="text-xs text-muted">
          We couldn&apos;t find this edition on Libby. Its collection is
          separate, so it may not have it.
        </p>
      )}
      {s.kind === "error" && (
        <p className="text-xs text-muted">
          Couldn&apos;t check availability just now. The links still work.
        </p>
      )}
    </div>
  );
}
