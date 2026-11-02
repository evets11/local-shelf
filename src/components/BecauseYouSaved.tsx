"use client";

import { useEffect, useState } from "react";
import type { CardTitle } from "@/lib/card";
import type { Kind } from "@/lib/types";
import { useMyList } from "@/lib/my-list";
import { Shelf } from "./Shelf";

type Result = { key: string; basedOn: string | null; items: CardTitle[] };

/** A home-page row of picks similar to what you've saved. Hidden until you save something. */
export function BecauseYouSaved({ kind }: { kind: Kind }) {
  const { list } = useMyList();
  const key = list.slice(0, 50).join(",");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/recommend?kind=${kind}&ids=${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Omit<Result, "key">) => setResult({ key, ...data }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [key, kind]);

  if (!key || !result || result.key !== key || !result.basedOn || result.items.length === 0) return null;
  return <Shelf title={`Because you saved ${result.basedOn}`} items={result.items} />;
}
