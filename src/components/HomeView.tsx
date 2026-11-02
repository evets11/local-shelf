import { FeaturedCarousel } from "./FeaturedCarousel";
import { Shelf } from "./Shelf";
import { BecauseYouSaved } from "./BecauseYouSaved";
import { getFeaturedCandidates, getHomeShelves } from "@/lib/catalog";
import { toCard, toFeature } from "@/lib/card";
import type { Kind } from "@/lib/types";
import { COLLECTION_TITLES } from "@/lib/site";

const INTROS: Record<Kind, string> = {
  film: "Tonight's pick from the library",
  book: "Fresh on the shelves",
  audiobook: "Something to listen to",
};

export function HomeView({ kind }: { kind: Kind }) {
  const featured = getFeaturedCandidates(kind).map(toFeature);
  const shelves = getHomeShelves(kind);
  if (shelves.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-3xl font-semibold">Stocking the shelves…</p>
        <p className="mt-2 text-muted">This collection hasn&apos;t been synced yet. Check back soon.</p>
      </div>
    );
  }
  return (
    <div className="space-y-12 pb-8">
      <h1 className="sr-only">{COLLECTION_TITLES[kind]}</h1>
      <FeaturedCarousel items={featured} intro={INTROS[kind]} />
      <div className="space-y-12">
        {shelves.slice(0, 1).map((s) => (
          <Shelf key={s.id} title={s.title} href={s.href} items={s.items.map(toCard)} eager />
        ))}
        <BecauseYouSaved kind={kind} />
        {shelves.slice(1).map((s) => (
          <Shelf
            key={s.id}
            title={s.title}
            href={s.href}
            items={s.items.map(toCard)}
            jumbo={s.id === "available"}
          />
        ))}
      </div>
    </div>
  );
}
