"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getLastActivated } from "@/lib/last-activated";

/** Route-driven modal: closing it navigates back to the page underneath. */
export function Modal({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // Set when we close the dialog ourselves on hide/unmount, so onClose doesn't navigate.
  const silentClose = useRef(false);
  // Whatever opened the dialog (usually a title card), so keyboard focus can go back to it.
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    silentClose.current = false;
    const last = getLastActivated();
    opener.current = last && !d.contains(last) ? last : null;
    if (!d.open) d.showModal();
    // Next keeps hidden routes mounted (display: none) and runs effect cleanups. An open
    // modal dialog stays in the top layer and makes the visible page inert, so close it.
    return () => {
      silentClose.current = true;
      d.close();
      refocus(opener.current);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    const el = sheet.current;
    return d && el ? swipeToDismiss(d, el) : undefined;
  }, []);

  useEffect(() => {
    // Each modal open is a fresh title; start at the top.
    ref.current?.scrollTo({ top: 0 });
  }, [children]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => {
        // Re-opened since (e.g. Strict Mode remount): this close event is stale.
        if (silentClose.current || ref.current?.open) return;
        router.back();
        refocus(opener.current);
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      // Phones: a sheet just below the status bar. Larger screens: a centred card.
      className="mx-0 mb-0 mt-[calc(env(safe-area-inset-top)+0.5rem)] h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] max-h-none w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl bg-transparent p-0 text-ink sm:mx-auto sm:my-8 sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:max-w-5xl sm:rounded-xl"
    >
      <div
        ref={sheet}
        className="animate-fade-up sheet-up relative min-h-full rounded-t-2xl bg-card shadow-2xl sm:min-h-0 sm:overflow-hidden sm:rounded-xl"
      >
        {/* Grab handle: drag the sheet down to close. */}
        <div aria-hidden className="absolute inset-x-0 top-1.5 z-10 flex justify-center sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-white/40 shadow-sm" />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => ref.current?.close()}
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-card/90 shadow transition hover:bg-card"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </dialog>
  );
}

/**
 * Put keyboard focus back on whatever opened the dialog. The page underneath is shown again
 * only once router.back() settles, and may re-render (a new node for the same card), so find it
 * again by its link and retry briefly until it's visible.
 */
function refocus(opener: HTMLElement | null, tries = 0) {
  if (!opener) return;
  const href = opener.getAttribute("href");
  const el = opener.isConnected
    ? opener
    : href
      ? [...document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`)].find((a) => a.offsetParent !== null)
      : undefined;
  if (el && document.activeElement === el) return;
  if (el && el.offsetParent !== null) el.focus({ preventScroll: true });
  if (tries < 10) setTimeout(() => refocus(opener, tries + 1), 60);
}

/**
 * Phones: drag the sheet down from the top to close it, like an iOS sheet. Only a mostly
 * vertical downward drag that starts with the sheet scrolled to the top counts, so
 * horizontal shelves and normal scrolling are untouched.
 */
function swipeToDismiss(dialog: HTMLDialogElement, el: HTMLElement): () => void {
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let dy = 0;
  let tracking: boolean | null = null;

  const reset = () => {
    el.style.transition = "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "";
  };
  const start = (e: TouchEvent) => {
    // Not from a dialog stacked inside this one (the trailer player).
    const own = (e.target as Element | null)?.closest("dialog") === dialog;
    tracking = own && innerWidth < 640 && dialog.scrollTop <= 0 && e.touches.length === 1 ? null : false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = performance.now();
    dy = 0;
  };
  const move = (e: TouchEvent) => {
    if (tracking === false) return;
    const x = e.touches[0].clientX - startX;
    dy = e.touches[0].clientY - startY;
    if (tracking === null) {
      if (Math.abs(x) < 8 && Math.abs(dy) < 8) return;
      tracking = dy > 0 && Math.abs(dy) > Math.abs(x) * 1.2;
      if (!tracking) return;
    }
    e.preventDefault(); // stop the sheet's own rubber-band scroll while dragging
    el.style.transition = "none";
    el.style.transform = `translateY(${Math.max(0, dy)}px)`;
  };
  const end = () => {
    if (!tracking) return;
    tracking = false;
    const velocity = dy / Math.max(1, performance.now() - startT); // px per ms
    if (dy > 140 || (dy > 40 && velocity > 0.6)) {
      el.style.transition = "transform 220ms ease-in";
      el.style.transform = "translateY(100%)";
      setTimeout(() => {
        dialog.close();
        // If the route didn't change (e.g. a stale close), don't leave the sheet off-screen.
        setTimeout(reset, 300);
      }, 200);
    } else reset();
  };

  dialog.addEventListener("touchstart", start, { passive: true });
  dialog.addEventListener("touchmove", move, { passive: false });
  dialog.addEventListener("touchend", end);
  dialog.addEventListener("touchcancel", end);
  return () => {
    dialog.removeEventListener("touchstart", start);
    dialog.removeEventListener("touchmove", move);
    dialog.removeEventListener("touchend", end);
    dialog.removeEventListener("touchcancel", end);
  };
}
