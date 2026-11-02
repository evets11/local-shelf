import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-semibold text-sea">Off the shelf</p>
      <p className="mt-3 text-muted">We couldn&apos;t find that. It may have dropped out of Local Shelf, or left the library&apos;s collection.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-sea px-5 py-2.5 font-semibold text-on-sea">
        Back to browsing
      </Link>
    </div>
  );
}
