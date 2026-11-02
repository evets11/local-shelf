import type { Metadata } from "next";
import { ExternalLink, Heart } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { KOFI_URL } from "@/components/Support";
import { OG_BASE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Local Shelf is a free, not-for-profit community project for Brighton & Hove library users. Donations cover hosting and running costs.",
  alternates: { canonical: "/support" },
  openGraph: { ...OG_BASE, title: "Support Local Shelf", url: "/support" },
};

// Ko-fi's donation panel only (no profile, no widget script).
const EMBED = `${KOFI_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;

export default function SupportPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_400px] lg:items-start">
      <section className="space-y-5">
        <BackButton className="-mt-6" />
        <h1 className="flex items-center gap-3 font-display text-4xl font-semibold sm:text-5xl">
          <Heart className="h-9 w-9 shrink-0 text-coral" aria-hidden /> Support Local Shelf
        </h1>
        <p className="text-lg">
          Local Shelf is a free, not-for-profit community project that makes Brighton &amp; Hove Libraries easier to
          browse. If it&apos;s helped you find something, a small donation keeps it running.
        </p>
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Where your money goes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Hosting, the domain name and the nightly catalogue update.</li>
            <li>Anything left over goes towards new features.</li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Donations don&apos;t go to Brighton &amp; Hove Libraries or the council. To help the library itself,
            borrowing, joining and reserving all count.
          </p>
        </div>
        <p className="text-sm text-muted">
          Payments are handled securely by Ko-fi with PayPal or card. Local Shelf never sees your payment details. The form is loaded from Ko-fi and covered by Ko-fi&apos;s own privacy policy.
        </p>
      </section>

      <section aria-labelledby="donate-heading" className="space-y-3">
        <h2 id="donate-heading" className="sr-only">
          Donate
        </h2>
        {/* Ko-fi's panel is light-themed; sit it on a light card in either theme. */}
        <div className="overflow-hidden rounded-2xl bg-[#f9f9f9] shadow-lg ring-1 ring-line">
          <iframe
            src={EMBED}
            title="Donate to Local Shelf on Ko-fi"
            loading="lazy"
            className="block h-[600px] w-full border-0"
          />
        </div>
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Form not loading? Open Ko-fi instead <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </section>
    </div>
  );
}
