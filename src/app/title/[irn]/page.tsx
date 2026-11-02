import { BackButton } from "@/components/BackButton";
import { modeByKind } from "@/lib/modes";
import type { Metadata } from "next";
import { posterUrl, tidySummary } from "@/lib/format";
import { OG_BASE, SITE_NAME, breadcrumbJsonLd, titleDescription, titleHeadline, titleJsonLd } from "@/lib/site";
import type { Title } from "@/lib/types";
import { JsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { getPrerenderedTitles, getTitle } from "@/lib/catalog";
import { Suspense } from "react";
import { DetailSkeleton } from "@/components/Skeleton";
import { TitleDetail } from "@/components/TitleDetail";

// Unlisted titles render in full on their first visit, then are cached. The root layout's
// header reads the URL, so a generic App Shell for an unknown title can't be prerendered.
export const instant = false;

export function generateStaticParams() {
  return getPrerenderedTitles().map((t) => ({ irn: t.irn }));
}

/** Shared by the metadata and the page. */
function seo(t: Title) {
  const summary = t.summary ? tidySummary(t.summary) : null;
  return {
    summary,
    headline: titleHeadline(t),
    description: titleDescription(t, summary),
    // Only TMDB posters are shareable: the library's cover service can return a blank image
    // and its URLs carry the library's licence key. Otherwise the branded default card is used.
    image: t.tmdb?.posterPath ? posterUrl(t) : null,
    mode: modeByKind(t.kind),
  };
}

export async function generateMetadata({ params }: PageProps<"/title/[irn]">): Promise<Metadata> {
  const t = getTitle((await params).irn);
  if (!t) return {};
  const { headline, description, image } = seo(t);
  return {
    title: headline,
    description,
    alternates: { canonical: `/title/${t.irn}` },
    openGraph: {
      ...OG_BASE,
      type: t.kind === "film" ? "video.movie" : "book",
      title: headline,
      description,
      url: `/title/${t.irn}`,
      ...(image && { images: [{ url: image, alt: `Poster for ${t.title}` }] }),
    },
    // Posters are portrait; a small card shows them better than a cropped large one.
    twitter: { card: image ? "summary" : "summary_large_image" },
  };
}

// Other titles render on first visit: params are awaited inside <Suspense>, so the shell (with a
// skeleton) is served at once and the finished page is cached for later visits.
export default function TitlePage({ params }: PageProps<"/title/[irn]">) {
  return (
    <div className="mx-auto max-w-6xl bg-card sm:my-8 sm:overflow-hidden sm:rounded-xl">
      <Suspense fallback={<DetailSkeleton />}>
        <TitleContent params={params} />
      </Suspense>
    </div>
  );
}

async function TitleContent({ params }: Pick<PageProps<"/title/[irn]">, "params">) {
  const t = getTitle((await params).irn);
  if (!t) notFound();
  const { summary, image, mode } = seo(t);
  return (
    <>
      <BackButton always fallback={mode.home} className="px-4 pt-3 sm:px-8" />
      <TitleDetail t={t} />
      <JsonLd data={titleJsonLd(t, image, summary)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: mode.label, path: `/browse/${mode.slug}` },
          { name: t.title, path: `/title/${t.irn}` },
        ])}
      />
    </>
  );
}
