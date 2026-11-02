"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Whether Back stays on this site. The Navigation API knows; without it, history.length counts
 * other sites' entries too, so also require that we arrived from one of our own pages.
 */
function canGoBack(): boolean {
  const nav = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
  if (typeof nav?.canGoBack === "boolean") return nav.canGoBack;
  return history.length > 1 && document.referrer.startsWith(location.origin);
}

/** Back within the site, or to `fallback` when there's nothing of ours to go back to. */
export function goBack(router: ReturnType<typeof useRouter>, fallback: string) {
  if (canGoBack()) router.back();
  else router.push(fallback);
}

/**
 * iOS-style "‹ Back", only in the installed app (no browser back button there). Opened cold,
 * e.g. from a shared link, there's no history, so it goes to `fallback` instead.
 */
export function BackButton({
  fallback = "/",
  always = false,
  className = "",
}: {
  fallback?: string;
  /** Show in browsers too (detail pages with no other way out), not just the installed app. */
  always?: boolean;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => goBack(router, fallback)}
      className={`${always ? "inline-flex" : "standalone-only"} items-center gap-0.5 py-1 pr-2 text-base font-medium text-sea ${className}`}
    >
      <ChevronLeft className="-ml-1.5 h-6 w-6" aria-hidden /> Back
    </button>
  );
}
