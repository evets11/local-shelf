import { getTitle } from "@/lib/catalog";
import { toCard } from "@/lib/card";

/** Keep in sync with MyListView, which only judges the IRNs it actually sent. */
const MAX_IDS = 1000;

/** Cards for the IRNs in ?ids=1,2,3 (My List only knows saved IRNs from localStorage). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^\d+$/.test(id))
    .slice(0, MAX_IDS);
  const cards = ids.flatMap((id) => {
    const t = getTitle(id);
    return t ? [toCard(t)] : [];
  });
  return Response.json(cards, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
