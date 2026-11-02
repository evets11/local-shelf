/** Pieces shared by the catalogue title view and the live full-catalogue item view. */

/** Blurred cover behind the detail hero. */
export function HeroBackdrop({ art }: { art: string | null }) {
  return (
    <>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
    </>
  );
}

/** One label/value pair in a detail list (inside a <dl>). */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
