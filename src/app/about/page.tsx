import type { Metadata } from "next";
import Link from "next/link";
import { LIBRARY_LINKS } from "@/lib/spydus/urls";
import { OG_BASE } from "@/lib/site";
import { getCatalog } from "@/lib/catalog";
import { ShowWelcomeButton } from "@/components/Welcome";
import { BackButton } from "@/components/BackButton";
import { TmdbCredit } from "@/components/TmdbCredit";
import { SupportBlurb, SupportLink } from "@/components/Support";

export const metadata: Metadata = {
  title: "About Local Shelf",
  description:
    "What Local Shelf is, how to borrow from Brighton & Hove Libraries, accessibility settings and where the data comes from.",
  alternates: { canonical: "/about" },
  openGraph: { ...OG_BASE, title: "About Local Shelf", url: "/about" },
};

const fmt = (n: number) => n.toLocaleString("en-GB");

export default function AboutPage() {
  const films = getCatalog("film");
  const books = getCatalog("book");
  const audio = getCatalog("audiobook");
  const updated = new Date(films.generatedAt).toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  });

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-10 sm:px-8">
      <section className="space-y-4">
        <BackButton className="-mt-6" />
        <h1 className="font-display text-5xl font-semibold">
          About Local Shelf
        </h1>
        <p className="text-lg">
          Brighton &amp; Hove libraries lend thousands of films, books and
          audiobooks, but their catalogue is built for librarians, not for
          browsing on the sofa. Local Shelf is a community-made shop window for
          the collection.
        </p>
        <ul className="grid gap-3 rounded-xl border border-line bg-card p-5 sm:grid-cols-3">
          <li>
            <strong className="block">Explore</strong>
            <span className="text-sm text-muted">
              Films &amp; TV, books and audiobooks, with covers, genres,
              trailers and ratings.
            </span>
          </li>
          <li>
            <strong className="block">Check the shelf</strong>
            <span className="text-sm text-muted">
              See which library has a copy in right now, or set your own
              library.
            </span>
          </li>
          <li>
            <strong className="block">Borrow from the library</strong>
            <span className="text-sm text-muted">
              Reserve or borrow on the library&apos;s own site with your library
              card.
            </span>
          </li>
        </ul>
        <p className="text-muted">
          It&apos;s unofficial and not affiliated with Brighton &amp; Hove City
          Council. Nothing here replaces the library: reservations, loans,
          renewals and fees all happen on the{" "}
          <a
            className="underline hover:text-ink"
            href={LIBRARY_LINKS.catalogue}
          >
            library catalogue
          </a>
          .
        </p>
        <p className="browser-only text-sm">
          <ShowWelcomeButton />
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl font-semibold">
          What&apos;s in here
        </h2>
        <ul className="space-y-2">
          <li>
            <strong>Films &amp; TV:</strong> all {fmt(films.titles.length)} DVDs
            and Blu-rays, with live shelf checks, plus IMDb and Rotten Tomatoes
            links where we can match them.
          </li>
          <li>
            <strong>Books:</strong> the {fmt(books.titles.length)} newest
            additions across adult, young adult and children&apos;s fiction and
            non-fiction.
          </li>
          <li>
            <strong>Audiobooks:</strong> the {fmt(audio.titles.length)} newest
            CD audiobooks and eAudiobooks.
          </li>
        </ul>
        <p className="text-sm text-muted">
          The full book and audiobook collections are far too big to mirror
          politely, so browsing shows what&apos;s new. Searching still covers
          everything: we ask the library&apos;s catalogue live and show the
          results alongside.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl font-semibold">How to borrow</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Find something you fancy. &ldquo;On the shelf now&rdquo; and the
            library filter show what&apos;s in at your branch.
          </li>
          <li>
            Pop into that library and grab it, or hit{" "}
            <strong>Reserve at the library</strong> to place a hold on the
            library&apos;s own site (you&apos;ll need your library card).
          </li>
          <li>
            eAudiobooks are borrowed through the BorrowBox or Libby apps with
            your library card.
          </li>
          <li>
            Not a member?{" "}
            <a className="underline hover:text-ink" href={LIBRARY_LINKS.join}>
              Join online
            </a>
            . It&apos;s free.
          </li>
        </ol>
      </section>

      <section id="accessibility" className="scroll-mt-24 space-y-3">
        <h2 className="font-display text-3xl font-semibold">
          Accessibility &amp; settings
        </h2>
        <p>
          You can switch between dark and light themes, turn on the Kids
          profile, choose bigger or smaller covers, make the text bigger, switch
          to high contrast, use an extra-readable typeface, turn off animations,
          and pick your local library so we only show what&apos;s there.{" "}
          <Link href="/settings" className="font-medium text-sea underline">
            Open settings
          </Link>
          .
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            Everything works with a keyboard. Press Tab to move, Enter to open,
            Escape to close.
          </li>
          <li>
            There&apos;s a &ldquo;Skip to main content&rdquo; link at the very
            top of each page.
          </li>
          <li>
            We follow your device&apos;s reduced-motion setting automatically.
          </li>
          <li>
            Settings and My List are stored in your browser only. There are no
            accounts or cookies. We count page views anonymously with Vercel Web
            Analytics, which doesn&apos;t identify you.
          </li>
        </ul>
        <p className="text-sm text-muted">
          Spotted something that&apos;s hard to use? We&apos;d love to fix it.
        </p>
      </section>

      <section id="support" className="scroll-mt-24 space-y-3">
        <h2 className="font-display text-3xl font-semibold">
          Supporting Local Shelf
        </h2>
        <SupportBlurb />
        <p>
          <SupportLink className="rounded-full border border-line bg-card px-4 py-2 font-semibold hover:border-sea">
            Donate
          </SupportLink>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl font-semibold">
          Where the data comes from
        </h2>
        <p>
          Once a day we read listings from the public library catalogue, gently
          and only from the pages it allows robots to visit (plus one search per
          collection to list what&apos;s there). Each title page checks the
          shelves live when you open it, and book and audiobook searches are
          passed on to the library&apos;s catalogue, cached and capped so we
          never put much load on it. Covers come from the library&apos;s own
          cover service. Film links and critics&apos; scores come from{" "}
          <a
            className="underline hover:text-ink"
            href="https://www.wikidata.org/"
          >
            Wikidata
          </a>
          .
        </p>
        <TmdbCredit className="text-sm text-muted" />
        <p className="text-sm text-muted">
          Catalogue last refreshed {updated}.
        </p>
      </section>

      <p>
        <Link href="/" className="font-medium text-sea underline">
          Back to browsing
        </Link>
      </p>
    </div>
  );
}
