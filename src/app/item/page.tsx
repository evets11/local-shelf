import type { Metadata } from "next";
import { Suspense } from "react";
import { ExternalItem } from "@/components/ExternalItem";
import { DetailSkeleton } from "@/components/Skeleton";
import { BackButton } from "@/components/BackButton";

export const metadata: Metadata = { title: "From the library catalogue", robots: { index: false, follow: true } };

/** Detail for a full-catalogue search result (not in our index), loaded live. */
export default function ItemPage() {
  return (
    <div className="mx-auto max-w-6xl sm:my-8">
      <BackButton always className="px-4 pt-3 sm:px-0" />
      <Suspense fallback={<DetailSkeleton />}>
        <ExternalItem />
      </Suspense>
    </div>
  );
}
