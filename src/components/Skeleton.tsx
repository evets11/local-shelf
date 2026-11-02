/** Placeholder shapes shown while content loads. Shimmer stops under reduced motion. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block rounded ${className}`} />;
}

/** Screen readers get one "Loading …" line; the shapes themselves are hidden. */
function Busy({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Same shape as a TitleCard: 2:3 cover, title, byline. */
export function CardSkeleton() {
  return (
    <div>
      <Bone className="aspect-[2/3] w-full rounded-md" />
      <Bone className="mt-2 h-3.5 w-4/5" />
      <Bone className="mt-1.5 h-3 w-1/2" />
    </div>
  );
}

export function CardGridSkeleton({
  count = 12,
  label = "Loading titles",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <Busy label={label} className="card-grid gap-x-3 gap-y-7 sm:gap-x-5">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </Busy>
  );
}

/** Mirrors the title detail hero: cover beside heading, meta and a button, then text. */
export function DetailSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <Busy label={label} className="overflow-hidden bg-card sm:rounded-xl">
      <div className="flex flex-col gap-6 bg-paper-2/40 p-5 pt-10 sm:flex-row sm:items-end sm:p-8 sm:pt-12">
        <Bone className="aspect-[2/3] w-36 shrink-0 rounded-md sm:w-48" />
        <div className="w-full max-w-xl space-y-3">
          <Bone className="h-3 w-40" />
          <Bone className="h-9 w-3/4 sm:h-12" />
          <Bone className="h-4 w-48" />
          <Bone className="h-3.5 w-32" />
          <Bone className="h-10 w-44 rounded-full" />
        </div>
      </div>
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2.5">
          <Bone className="h-3.5 w-full" />
          <Bone className="h-3.5 w-full" />
          <Bone className="h-3.5 w-11/12" />
          <Bone className="h-3.5 w-2/3" />
        </div>
        <div className="space-y-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-24 w-full rounded-md" />
        </div>
      </div>
    </Busy>
  );
}
