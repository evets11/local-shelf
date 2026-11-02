import type { Metadata } from "next";
import { ExplorerPage } from "@/components/ExplorerPage";
import { MODES, modeBySlug } from "@/lib/modes";
import { OG_BASE } from "@/lib/site";

export function generateStaticParams() {
  return MODES.map((m) => ({ mode: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/browse/[mode]">): Promise<Metadata> {
  const mode = modeBySlug((await params).mode);
  if (!mode) return { title: "Browse" };
  const title = `Browse every ${mode.noun} at Brighton & Hove Libraries`;
  const description = `All ${mode.label.toLowerCase()} in the Brighton & Hove Libraries collection we list, filterable by library, genre, decade and what's on the shelf now.`;
  return {
    title,
    description,
    // Filters live in the query string; they're all the same page to a search engine.
    alternates: { canonical: `/browse/${mode.slug}` },
    openGraph: { ...OG_BASE, title, description, url: `/browse/${mode.slug}` },
  };
}

export default async function BrowsePage({ params }: PageProps<"/browse/[mode]">) {
  const { mode } = await params;
  return <ExplorerPage slug={mode} heading={(label) => `Browse ${label}`} />;
}
