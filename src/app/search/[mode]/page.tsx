import type { Metadata } from "next";
import { ExplorerPage } from "@/components/ExplorerPage";
import { MODES, modeBySlug } from "@/lib/modes";

export function generateStaticParams() {
  return MODES.map((m) => ({ mode: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/search/[mode]">): Promise<Metadata> {
  const mode = modeBySlug((await params).mode);
  return {
    title: mode ? `Search ${mode.label}` : "Search",
    // Result pages are endless near-duplicates; let crawlers follow links but not index them.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ params }: PageProps<"/search/[mode]">) {
  const { mode } = await params;
  return <ExplorerPage slug={mode} heading={() => "Search"} />;
}
