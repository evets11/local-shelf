import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Explorer } from "./Explorer";
import { getTitles } from "@/lib/catalog";
import { toSearch } from "@/lib/card";
import { modeBySlug } from "@/lib/modes";

/** Shared body of /browse/[mode] and /search/[mode]. */
export function ExplorerPage({ slug, heading }: { slug: string; heading: (label: string) => string }) {
  const mode = modeBySlug(slug);
  if (!mode) notFound();
  return (
    <Suspense>
      <Explorer
        kind={mode.kind}
        titles={getTitles(mode.kind).map(toSearch)}
        heading={heading(mode.label)}
        partial={mode.kind !== "film"}
      />
    </Suspense>
  );
}
