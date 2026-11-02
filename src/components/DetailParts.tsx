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

/** e-items: where to borrow them. */
export function BorrowOnline() {
  return (
    <div className="space-y-2 rounded-lg border border-line p-4 text-sm">
      <h3 className="font-semibold">Borrow it online</h3>
      <p className="text-muted">
        This is a digital loan. Sign in with your library card on the
        library&apos;s apps:
      </p>
      <ul className="space-y-1">
        <li>
          <a
            className="text-sea underline"
            href="https://brighton.borrowbox.com/"
            target="_blank"
            rel="noopener"
          >
            BorrowBox
          </a>
        </li>
        <li>
          <a
            className="text-sea underline"
            href="https://libbyapp.com/library/brightonhovegb"
            target="_blank"
            rel="noopener"
          >
            Libby
          </a>
        </li>
      </ul>
    </div>
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
