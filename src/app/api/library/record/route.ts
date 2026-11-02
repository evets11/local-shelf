import { BadRequestError, getLibraryRecord, type SearchKind } from "@/lib/spydus/client";
import { errorResponse } from "../errors";

const ID = /^\d{1,12}$/;
const KINDS: SearchKind[] = ["book", "audiobook"];

/**
 * GET /api/library/record?irn=&set=&pos=[&kind=&q=&audience=children] : full record + live
 * holdings for a search hit. kind/q/audience (the original search) let an expired set recover.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const irn = params.get("irn") ?? "";
    const set = params.get("set") ?? "";
    const pos = params.get("pos") ?? "";
    if (!ID.test(irn) || !ID.test(set) || !/^\d{1,5}$/.test(pos))
      throw new BadRequestError("irn, set and pos must be numbers");
    const kind = params.get("kind") || null;
    if (kind !== null && !KINDS.includes(kind as SearchKind)) throw new BadRequestError("kind must be book or audiobook");
    const q = params.get("q") || null;
    if (q !== null && (q.trim().length < 3 || q.length > 100)) throw new BadRequestError("q must be 3-100 characters");
    const aud = params.get("audience") || null;
    if (aud !== null && aud !== "children") throw new BadRequestError("audience must be children");
    const title = await getLibraryRecord(set, irn, Number(pos), {
      kind: (kind as SearchKind) ?? undefined,
      q: q ?? undefined,
      audience: aud === "children" ? "children" : null,
    });
    return Response.json(title, {
      // Shelf info failed this time: don't let the CDN keep that answer either.
      headers: {
        "Cache-Control": title.holdingsUnknown
          ? "no-store"
          : "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return errorResponse(e, "library/record");
  }
}
