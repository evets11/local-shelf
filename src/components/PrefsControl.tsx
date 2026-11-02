"use client";

import Link from "next/link";
import { MapPin, Settings2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { setPrefs, usePrefs } from "@/lib/prefs";

/** "Jubilee Library" -> "Jubilee", for chips. */
export const shortBranch = (b: string) => b.replace(/ Library$/, "");

/** Branch choices, keeping a saved library that's since dropped out of the list so it still shows as chosen. */
export const branchOptions = (saved: string, branches: string[]) =>
  saved && !branches.includes(saved) ? [saved, ...branches] : branches;

/** Close a popover on a tap outside `root` or on Escape, while `open`. */
export function useDismiss(
  root: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [root, open, close]);
}

/** "My library · On the shelf" chip in the top bar, with a small popover to change it. */
export function PrefsControl({ branches }: { branches: string[] }) {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useDismiss(root, open, () => setOpen(false));

  const label = prefs.branch ? shortBranch(prefs.branch) : "Any library";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
          prefs.branch || prefs.onShelfOnly
            ? "border-sea bg-sea/10 text-sea"
            : "border-line bg-card text-ink hover:border-sea"
        }`}
      >
        <MapPin className="h-4 w-4" aria-hidden />
        <span className="max-w-32 truncate whitespace-nowrap">{label}</span>
        {prefs.onShelfOnly && (
          <span className="text-xs opacity-80">· on shelf</span>
        )}
        <span className="sr-only">, change library preferences</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Library preferences"
          className="absolute right-0 top-full z-50 mt-2 w-72 space-y-4 rounded-xl border border-line bg-card p-4 text-sm shadow-xl"
        >
          <label className="block space-y-1">
            <span className="font-semibold">My library</span>
            <select
              value={prefs.branch}
              onChange={(e) => setPrefs({ branch: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-paper px-2 outline-none focus:border-sea"
            >
              <option value="">Any library</option>
              {branchOptions(prefs.branch, branches).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <Switch
            checked={prefs.onShelfOnly}
            onChange={(v) => setPrefs({ onShelfOnly: v })}
            label="Only show what's on the shelf"
            hint={
              prefs.branch
                ? `At ${shortBranch(prefs.branch)} right now.`
                : "At any library right now."
            }
          />

          <p className="text-xs text-muted">
            Applies everywhere. Saved on this device only.
          </p>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 font-medium text-sea hover:underline"
          >
            <Settings2 className="h-4 w-4" aria-hidden /> Text size, contrast
            and more
          </Link>
        </div>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <span id={`${id}-label`} className="font-semibold">
          {label}
        </span>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-sea" : "bg-line"}`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
