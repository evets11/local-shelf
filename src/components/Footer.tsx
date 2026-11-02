import Link from "next/link";
import { LIBRARY_LINKS } from "@/lib/spydus/urls";
import { MODES } from "@/lib/modes";
import { SupportLink } from "./Support";
import { TmdbCredit } from "./TmdbCredit";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-paper-2 px-4 py-10 text-sm text-muted sm:px-8">
      <div className="mx-auto grid max-w-[1800px] gap-8 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-2">
          <p className="font-display text-2xl font-semibold text-ink">
            Local Shelf
          </p>
          <p className="max-w-xl">
            An unofficial community project that makes the Brighton &amp; Hove
            Libraries collection nicer to browse. We&apos;re not affiliated with
            Brighton &amp; Hove City Council. Reservations, loans and fees are
            all handled by the library.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">Explore</p>
          <ul className="space-y-1">
            {MODES.map((m) => (
              <li key={m.kind}>
                <Link href={m.home} className="hover:text-ink">
                  {m.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/my-list" className="hover:text-ink">
                My List
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-ink">
                About
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">The library</p>
          <ul className="space-y-1">
            <li>
              <a className="hover:text-ink" href={LIBRARY_LINKS.home}>
                Brighton &amp; Hove Libraries
              </a>
            </li>
            <li>
              <a className="hover:text-ink" href={LIBRARY_LINKS.catalogue}>
                Catalogue &amp; your account
              </a>
            </li>
          </ul>
          <p className="pt-3">
            <SupportLink className="font-medium text-ink hover:text-sea" />
          </p>
          <p className="pt-2 text-xs">
            Film links and scores from{" "}
            <a
              className="underline hover:text-ink"
              href="https://www.wikidata.org/"
            >
              Wikidata
            </a>{" "}
            (CC0).
          </p>
          <TmdbCredit className="pt-2 text-xs" />
        </div>
      </div>
    </footer>
  );
}
