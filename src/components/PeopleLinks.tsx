import Link from "next/link";
import { modeByKind } from "@/lib/modes";
import type { Title } from "@/lib/types";

/** Comma-separated names, each a search for their other titles. */
export function PeopleLinks({
  names,
  kind,
}: {
  names: string[];
  kind: Title["kind"];
}) {
  const slug = modeByKind(kind).slug;
  return (
    <span>
      {names.map((name, i) => (
        <span key={name}>
          <Link
            href={`/search/${slug}?q=${encodeURIComponent(name)}`}
            className="hover:text-sea hover:underline"
          >
            {name}
          </Link>
          {i < names.length - 1 ? ", " : ""}
        </span>
      ))}
    </span>
  );
}
