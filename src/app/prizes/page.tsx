import type { Metadata } from "next";
import { Suspense } from "react";
import { PrizeSections, PrizeSectionsForUrl } from "@/components/PrizeSections";
import { getPrizeSections, prizesCheckedAt } from "@/lib/prizes/shelves";
import { OG_BASE } from "@/lib/site";

const TITLE = "Book prizes";
const DESCRIPTION =
  "Winners and shortlists from the Booker, Women's Prize, Carnegie and other UK book prizes that you can borrow from Brighton & Hove libraries, with what's on the shelf right now.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/prizes" },
  openGraph: {
    ...OG_BASE,
    title: TITLE,
    description: DESCRIPTION,
    url: "/prizes",
  },
};

export default function PrizesPage() {
  const sections = getPrizeSections().filter((s) => s.picks.length > 0);
  const checked = prizesCheckedAt
    ? new Date(prizesCheckedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
      })
    : null;
  return (
    <div className="pb-10 pt-6">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8">
        <h1 className="font-display text-4xl font-semibold">{TITLE}</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Winners, shortlists and longlists from the big UK book prizes. We only
          show books Brighton &amp; Hove Libraries hold, in print, as an eBook
          or as an audiobook.
        </p>
      </div>
      <div className="mt-6">
        {/* The collection comes from the URL in the browser; the static HTML shows books. */}
        <Suspense fallback={<PrizeSections sections={sections} kind="book" />}>
          <PrizeSectionsForUrl sections={sections} />
        </Suspense>
      </div>
      <p className="mx-auto mt-12 max-w-[1800px] px-4 text-xs text-muted sm:px-8">
        Prize lists come from{" "}
        <a
          href="https://en.wikipedia.org/"
          target="_blank"
          rel="noopener"
          className="underline underline-offset-2"
        >
          Wikipedia
        </a>
        {checked ? `, last checked ${checked}` : ""}. Local Shelf isn&apos;t
        connected to any of these prizes.
      </p>
    </div>
  );
}
