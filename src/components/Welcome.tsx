"use client";

import Link from "next/link";
import { BookOpenCheck, Library, MapPin, X } from "lucide-react";
import { WELCOMED_KEY } from "@/lib/prefs-script";

/** Hides the welcome for good. CSS does the hiding via <html data-welcomed>. */
export function dismissWelcome() {
  try {
    localStorage.setItem(WELCOMED_KEY, "1");
  } catch {}
  document.documentElement.dataset.welcomed = "1";
}

export function showWelcomeAgain() {
  try {
    localStorage.removeItem(WELCOMED_KEY);
  } catch {}
  delete document.documentElement.dataset.welcomed;
}

/**
 * First-visit explainer under the header. Always rendered; returning visitors never see it
 * because the pre-paint script sets data-welcomed. Not a modal, so it never blocks browsing.
 * An inset card in page colours, so it doesn't run into the (hero-coloured) featured pick below.
 */
export function Welcome() {
  function close() {
    dismissWelcome();
    // Focusing #main would scroll it into view, past the phone header. Back to the top instead.
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  return (
    <section
      data-welcome
      aria-labelledby="welcome-title"
      className="mx-auto w-full max-w-[1800px] px-4 pb-2 pt-3 sm:px-8 sm:pb-4 sm:pt-6"
    >
      <div
        id="welcome-card"
        tabIndex={-1}
        className="relative rounded-2xl border border-line bg-paper-2 p-5 shadow-sm sm:p-8"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close welcome"
          className="absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-card hover:text-ink sm:right-4 sm:top-4"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr] lg:items-center">
          <div className="max-w-xl space-y-2 pr-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              New here?
            </p>
            <h2
              id="welcome-title"
              className="font-display text-2xl font-semibold sm:text-3xl"
            >
              An easier way to explore Brighton &amp; Hove Libraries
            </h2>
            <p className="text-muted">
              Local Shelf lets you browse the films, TV, books and audiobooks you
              can borrow from the city&apos;s libraries. It&apos;s a free,
              unofficial community project.
            </p>
          </div>
          <div className="space-y-5">
            <ul className="grid gap-2.5 text-sm sm:grid-cols-3 sm:gap-4">
              <Point icon={Library} title="Browse like a streaming app">
                Big covers, genres, trailers and ratings, instead of the
                library&apos;s catalogue search.
              </Point>
              <Point icon={MapPin} title="See what's on the shelf">
                Pick your library and only show things you can walk in and
                borrow today.
              </Point>
              <Point icon={BookOpenCheck} title="Borrow from the library">
                Reserving and borrowing happen on the library&apos;s own site
                with your library card.
              </Point>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={close}
                className="rounded-full bg-sea px-5 py-2.5 font-semibold text-on-sea hover:bg-sea-dark"
              >
                Start exploring
              </button>
              <Link
                href="/settings"
                onClick={dismissWelcome}
                className="rounded-full border border-line bg-card px-5 py-2.5 font-semibold hover:border-sea hover:text-sea"
              >
                Choose my library
              </Link>
              <Link
                href="/about"
                className="px-2 py-2.5 font-medium text-muted underline underline-offset-4 hover:text-ink"
              >
                More about Local Shelf
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Point({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Library;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 sm:block sm:space-y-1.5">
      <Icon className="h-6 w-6 shrink-0 text-sea" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="hidden text-muted sm:block">{children}</p>
      </div>
    </li>
  );
}

/** About page: bring the first-visit welcome back. */
export function ShowWelcomeButton() {
  return (
    <button
      type="button"
      onClick={() => {
        showWelcomeAgain();
        window.scrollTo({ top: 0 });
        document.getElementById("welcome-card")?.focus();
      }}
      className="font-medium text-sea underline"
    >
      Show the welcome again
    </button>
  );
}
