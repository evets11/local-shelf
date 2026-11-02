import Link from "next/link";
import { Heart } from "lucide-react";

/** Donations page. Change here if the Ko-fi username changes. */
export const KOFI_URL = "https://ko-fi.com/evets511";

/** Links to our own /support page, which explains donations and embeds Ko-fi's form. */
export function SupportLink({ className = "", children = "Support Local Shelf" }: { className?: string; children?: React.ReactNode }) {
  return (
    <Link href="/support" className={`inline-flex items-center gap-1.5 ${className}`}>
      <Heart className="h-4 w-4 shrink-0 text-coral" aria-hidden />
      {children}
    </Link>
  );
}

/** Where donations go, said plainly. Used on About and in Settings. */
export function SupportBlurb() {
  return (
    <p className="text-muted">
      Local Shelf is a free, not-for-profit community project. Donations through Ko-fi cover hosting and running costs. They don&apos;t
      go to Brighton &amp; Hove Libraries or the council. If you&apos;d rather help the library itself, borrowing,
      joining and reserving all count.
    </p>
  );
}
