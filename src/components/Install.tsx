"use client";

import { Check, Download, Plus, Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isIos, promptInstall, useInstallMode } from "@/lib/pwa";

const DISMISSED_KEY = "shelflife:install-dismissed";
const VIEWS_KEY = "shelflife:views";
/** After "Not now", stay quiet this long. */
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;
/** Pages seen (this session) before we suggest installing. */
const VIEWS_BEFORE_PROMPT = 3;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

/**
 * Phone/tablet install suggestion as a bottom sheet. Waits until the welcome is gone and
 * you've looked around a bit, never shows over a dialog, and stays quiet for a month after
 * "Not now". Android/Chromium gets the real install prompt; iOS gets Add to Home Screen steps.
 */
export function InstallSheet() {
  const mode = useInstallMode();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const views = useRef(0);

  // Count page views this session (declared first, so it runs before the check below).
  useEffect(() => {
    try {
      views.current = Number(sessionStorage.getItem(VIEWS_KEY) ?? 0) + 1;
      sessionStorage.setItem(VIEWS_KEY, String(views.current));
    } catch {
      views.current++;
    }
  }, [pathname]);

  useEffect(() => {
    if (open || (mode !== "prompt" && mode !== "ios")) return;
    if (views.current < VIEWS_BEFORE_PROMPT) return;
    // Installing needs the network (and the offline pill sits where this sheet does).
    if (!matchMedia("(pointer: coarse)").matches || !navigator.onLine) return;
    if (Date.now() - Number(read(DISMISSED_KEY) ?? 0) < QUIET_MS) return;
    // Let the page settle; never over the welcome or an open title.
    const t = setTimeout(() => {
      if (!document.documentElement.dataset.welcomed || document.querySelector("dialog[open]")) return;
      setOpen(true);
    }, 1500);
    return () => clearTimeout(t);
    // Re-evaluated per page view; `mode` changes when the browser offers (or loses) install.
  }, [pathname, mode, open]);

  // Installed (or no longer installable): get out of the way.
  if (!open || (mode !== "prompt" && mode !== "ios")) return null;

  const dismiss = () => {
    write(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-title"
    >
      <div className="sheet-in pointer-events-auto mx-2 sm:mx-auto sm:max-w-md mb-[calc(env(safe-area-inset-bottom)+4.75rem)] rounded-3xl border border-line bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pwa/apple-touch-icon.png"
            alt=""
            className="h-14 w-14 shrink-0 rounded-[14px] shadow"
          />
          <div className="min-w-0 flex-1">
            <h2
              id="install-title"
              className="text-lg font-semibold leading-tight"
            >
              Get the Local Shelf app
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Add it to your home screen. It opens full screen, and pages
              you&apos;ve viewed work offline.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-2 text-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {mode === "ios" ? <IosSteps /> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full bg-paper-2 py-3 font-semibold"
          >
            Not now
          </button>
          {mode === "prompt" && (
            <button
              type="button"
              onClick={async () => {
                if (!(await promptInstall())) dismiss();
              }}
              className="flex-1 rounded-full bg-sea py-3 font-semibold text-on-sea"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IosSteps() {
  return (
    <>
      <ol className="mt-4 space-y-2.5 rounded-2xl bg-paper-2 p-4 text-sm">
        <Step n={1}>
          Tap{" "}
          <Share
            className="mx-0.5 inline h-4 w-4 align-[-3px] text-sea"
            aria-label="Share"
          />{" "}
          Share. In Safari it&apos;s in the{" "}
          <span className="font-semibold">•••</span> menu by the address bar.
        </Step>
        <Step n={2}>
          Choose <span className="font-semibold">Add to Home Screen</span>{" "}
          <Plus
            className="inline h-4 w-4 rounded-sm border border-current align-[-3px]"
            aria-hidden
          />
          . You may need to tap <span className="font-semibold">View More</span>
          .
        </Step>
        <Step n={3}>
          Tap <span className="font-semibold">Add</span>.
        </Step>
      </ol>
      <p className="mt-2 text-xs text-muted">
        The app keeps its own settings and My List, separate from this browser.
      </p>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sea text-[11px] font-bold text-on-sea">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Settings: install on demand, on any device that supports it. */
export function InstallSettings() {
  const mode = useInstallMode();
  const [showSteps, setShowSteps] = useState(false);

  if (mode === "pending") return null;
  if (mode === "installed")
    return (
      <p className="flex items-center gap-2 text-sm">
        <Check className="h-4 w-4 text-sea" aria-hidden /> You&apos;re using the
        Local Shelf app.
      </p>
    );
  if (mode === "unsupported")
    return (
      <p className="text-sm text-muted">
        {isIos()
          ? "To install Local Shelf, open this page in Safari, then use Share, Add to Home Screen."
          : "To install Local Shelf, use your browser's menu: Install app or Add to Home screen in Chrome, Edge and Samsung Internet, or the install icon in the address bar on a computer."}
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Add Local Shelf to your home screen or desktop. It opens in its own
        window, and pages you&apos;ve viewed work offline.
      </p>
      <button
        type="button"
        onClick={() =>
          mode === "prompt" ? void promptInstall() : setShowSteps((s) => !s)
        }
        aria-expanded={mode === "ios" ? showSteps : undefined}
        className="inline-flex items-center gap-2 rounded-full bg-sea px-5 py-2.5 font-semibold text-on-sea"
      >
        <Download className="h-4 w-4" aria-hidden /> Install app
      </button>
      {mode === "ios" && showSteps && <IosSteps />}
    </div>
  );
}
