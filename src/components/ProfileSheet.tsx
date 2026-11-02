"use client";

import Link from "next/link";
import { Heart, Star, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { branchOptions, Switch } from "./PrefsControl";

const OPEN_EVENT = "localshelf:profile-sheet";

/** Opens the phone profile sheet from anywhere (header button, library chip). */
export function openProfileSheet() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Phone bottom sheet for the per-device choices: Everyone/Kids, my library, on the shelf only,
 * theme, and links out. A native <dialog>, so Escape, focus trapping and the top layer come free.
 */
export function ProfileSheet({ branches }: { branches: string[] }) {
  const prefs = usePrefs();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    addEventListener(OPEN_EVENT, show);
    return () => removeEventListener(OPEN_EVENT, show);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // The heading, not "Done", so touch users don't see a focus ring straight away.
      document.getElementById("profile-sheet-title")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => setOpen(false);
  const options = branchOptions(prefs.branch, branches);

  return (
    <dialog
      ref={ref}
      aria-labelledby="profile-sheet-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="profile-sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-card p-0 text-ink sm:mx-auto sm:max-w-md"
    >
      {open && (
        <div className="sheet-in space-y-6 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2.5">
          <span
            aria-hidden
            className="mx-auto block h-1.5 w-10 rounded-full bg-line"
          />
          <div className="flex items-center justify-between">
            <h2
              id="profile-sheet-title"
              tabIndex={-1}
              className="font-display text-2xl font-semibold outline-none"
            >
              You
            </h2>
            <button
              type="button"
              onClick={close}
              className="text-base font-semibold text-sea"
            >
              Done
            </button>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Profile
            </h3>
            <div
              role="radiogroup"
              aria-label="Profile"
              className="grid grid-cols-2 gap-2.5"
            >
              {(
                [
                  { value: "everyone", label: "Everyone", Icon: Users },
                  { value: "kids", label: "Kids", Icon: Star },
                ] as const
              ).map(({ value, label, Icon }) => {
                const active = prefs.profile === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPrefs({ profile: value })}
                    className={`flex h-16 items-center gap-2.5 rounded-2xl border px-4 text-[15px] font-semibold transition ${
                      active ? "border-2 border-sea bg-sea/10" : "border-line"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-sea" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted">
              Kids shows only children&apos;s films, books and audiobooks.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              My library
            </h3>
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-paper-2">
              <label className="flex min-h-13 items-center justify-between gap-3 px-4 py-2">
                <span>Library</span>
                <select
                  value={prefs.branch}
                  onChange={(e) => setPrefs({ branch: e.target.value })}
                  className="max-w-[60%] bg-transparent text-right text-muted outline-none"
                >
                  <option value="">Any library</option>
                  {options.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <div className="px-4 py-3">
                <Switch
                  checked={prefs.onShelfOnly}
                  onChange={(v) => setPrefs({ onShelfOnly: v })}
                  label="Only what's on the shelf"
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Appearance
            </h3>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="grid h-10 grid-cols-2 rounded-xl bg-paper-2 p-1"
            >
              {(["dark", "light"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === v}
                  onClick={() => setPrefs({ theme: v })}
                  className={`rounded-lg text-sm font-semibold capitalize transition ${
                    prefs.theme === v
                      ? "bg-ink/15 text-ink shadow-sm"
                      : "text-muted"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </section>

          <nav
            aria-label="More"
            className="flex items-center justify-between pt-1 text-[15px] font-medium text-sea"
          >
            <Link href="/settings" onClick={close}>
              All settings
            </Link>
            <Link href="/about" onClick={close}>
              About
            </Link>
            <Link
              href="/support"
              onClick={close}
              className="inline-flex items-center gap-1.5"
            >
              <Heart className="h-4 w-4 text-coral" aria-hidden /> Donate
            </Link>
          </nav>
        </div>
      )}
    </dialog>
  );
}
