import { getTitle, similarTitles } from "@/lib/catalog";
import { toCard } from "@/lib/card";
import type { Kind } from "@/lib/types";

const KINDS: Kind[] = ["film", "book", "audiobook"];

/**
 * "Because you saved X": titles similar to the user's most recent saves of one kind.
 * ?kind=film&ids=newest,first,... (My List order). Nothing is stored server-side.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as Kind | null;
  if (!kind || !KINDS.includes(kind)) return Response.json({ error: "Bad kind" }, { status: 400 });
  const saved = (url.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^\d+$/.test(id))
    .slice(0, 200)
    .flatMap((id) => {
      const t = getTitle(id);
      return t && t.kind === kind ? [t] : [];
    });
  if (saved.length === 0) return Response.json({ basedOn: null, items: [] });

  const exclude = new Set(saved.map((t) => t.irn));
  const items = [];
  for (const s of saved.slice(0, 3)) {
    for (const o of similarTitles(s, 20)) {
      if (exclude.has(o.irn)) continue;
      exclude.add(o.irn);
      items.push(toCard(o));
    }
  }
  return Response.json(
    { basedOn: saved[0].title, items: items.slice(0, 60) },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
