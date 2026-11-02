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
 */
export function Welcome() {
  function close() {
    dismissWelcome();
    document.getElementById("main")?.focus();
  }

  return (
    <section
      data-welcome
      tabIndex={-1}
      aria-labelledby="welcome-title"
      className="border-b border-line bg-hero text-white outline-none"
    >
      <div className="relative mx-auto max-w-[1800px] px-4 py-6 sm:px-8 sm:py-8">
        <button
          type="button"
          onClick={close}
          aria-label="Close welcome"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white sm:right-6"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr] lg:items-center">
          <div className="max-w-xl space-y-2 pr-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
              New here?
            </p>
            <h2
              id="welcome-title"
              className="font-display text-2xl font-semibold sm:text-3xl"
            >
              An easier way to explore Brighton &amp; Hove Libraries
            </h2>
            <p className="text-white/85">
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
                className="rounded-full bg-white px-5 py-2.5 font-semibold text-black hover:bg-white/90"
              >
                Start exploring
              </button>
              <Link
                href="/settings"
                onClick={dismissWelcome}
                className="rounded-full border border-white/40 px-5 py-2.5 font-semibold hover:bg-white/10"
              >
                Choose my library
              </Link>
              <Link
                href="/about"
                className="px-2 py-2.5 font-medium underline underline-offset-4 hover:text-white/80"
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
      <Icon className="h-6 w-6 shrink-0 text-white/80" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="hidden text-white/85 sm:block">{children}</p>
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
        document.getElementById("welcome-title")?.closest("section")?.focus();
      }}
      className="font-medium text-sea underline"
    >
      Show the welcome again
    </button>
  );
}
