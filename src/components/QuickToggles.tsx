"use client";

import Link from "next/link";
import { Award, BookOpen, Disc3, Moon, Smartphone, Star, Sun, Users } from "lucide-react";
import { setPrefs, usePrefs, type Prefs } from "@/lib/prefs";
import { prizesHref } from "@/lib/modes";

/** Everyone / Kids profile switch for the top bar. Both options are always labelled. */
export function ProfileToggle() {
  const { profile } = usePrefs();
  const options = [
    { value: "everyone", label: "Everyone", Icon: Users },
    { value: "kids", label: "Kids", Icon: Star },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Profile" className="flex rounded-full border border-line bg-card p-0.5 text-sm">
      {options.map((o) => {
        const active = profile === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPrefs({ profile: o.value })}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition ${
              active ? "bg-sea text-on-sea shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <o.Icon className="h-3.5 w-3.5" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Unmissable reminder under the top bar while the Kids profile is on. */
export function KidsBanner() {
  const { profile } = usePrefs();
  if (profile !== "kids") return null;
  return (
    <div role="status" className="border-b border-line bg-sea text-on-sea">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-8">
        <p className="font-semibold">
          <Star className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden />Kids profile is on. Only children&apos;s films, books and audiobooks are showing.
        </p>
        <button
          type="button"
          onClick={() => setPrefs({ profile: "everyone" })}
          className="rounded-full bg-on-sea/15 px-3 py-1 font-semibold underline-offset-2 hover:underline"
        >
          Switch to Everyone
        </button>
      </div>
    </div>
  );
}

export function ThemeToggle() {
  const { theme } = usePrefs();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setPrefs({ theme: dark ? "light" : "dark" })}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-paper-2"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

const AUDIO_OPTIONS = [
  { value: "all", label: "All", Icon: null },
  { value: "eaudiobook", label: "eAudiobooks", Icon: Smartphone },
  { value: "cd", label: "CDs", Icon: Disc3 },
] as const;

const BOOK_OPTIONS = [
  { value: "all", label: "All", Icon: null },
  { value: "ebook", label: "eBooks", Icon: Smartphone },
  { value: "print", label: "Print", Icon: BookOpen },
] as const;

/** Sub-filter under the header on Audiobooks (eAudiobooks/CDs), Books (eBooks/print) and prizes pages. */
export function FormatBar({ kind, onPrizes = false }: { kind: "audiobook" | "book"; onPrizes?: boolean }) {
  const prefs = usePrefs();
  const options = kind === "audiobook" ? AUDIO_OPTIONS : BOOK_OPTIONS;
  const current = kind === "audiobook" ? prefs.audioFormat : prefs.bookFormat;
  const pick = (v: (typeof options)[number]["value"]) =>
    setPrefs(kind === "audiobook" ? { audioFormat: v as Prefs["audioFormat"] } : { bookFormat: v as Prefs["bookFormat"] });
  return (
    <div className="border-b border-line bg-paper-2/60">
      <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-4 py-2 text-sm sm:gap-3 sm:px-8">
        {/* Visible from sm up; phones need the room for the buttons and the prizes link. */}
        <span id="format-bar-label" className="sr-only text-muted sm:not-sr-only">
          Show:
        </span>
        <div role="radiogroup" aria-labelledby="format-bar-label" className="flex gap-1.5">
          {options.map((o) => {
            const active = current === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(o.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition ${
                  active ? "border-sea bg-sea text-on-sea" : "border-line bg-card text-ink hover:border-sea"
                }`}
              >
                {o.Icon && <o.Icon className="h-3.5 w-3.5" aria-hidden />}
                {o.label}
              </button>
            );
          })}
        </div>
        {/* Prizes are books and audiobooks only, so they live on this bar rather than the main nav. */}
        {!onPrizes && (
          <Link
            href={prizesHref(kind)}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 font-medium text-sea hover:underline"
          >
            <Award className="h-4 w-4" aria-hidden />
            {/* Short on phones so it stays on one line with the format buttons. */}
            <span className="sm:hidden">Prizes</span>
            <span className="hidden sm:inline">Book prizes</span>
          </Link>
        )}
      </div>
    </div>
  );
}
