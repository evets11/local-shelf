import {
  BadRequestError,
  SEARCH_TTL_S,
  searchLibrary,
  type SearchAudience,
  type SearchKind,
} from "@/lib/spydus/client";
import { errorResponse } from "../errors";

const KINDS: SearchKind[] = ["book", "audiobook"];

/** GET /api/library/search?kind=book|audiobook&q=...[&audience=children] : live full-catalogue search. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const kind = params.get("kind") as SearchKind;
    if (!KINDS.includes(kind)) throw new BadRequestError("kind must be book or audiobook");
    const aud = params.get("audience");
    if (aud !== null && aud !== "children") throw new BadRequestError("audience must be children");
    const result = await searchLibrary(kind, params.get("q") ?? "", aud as SearchAudience);
    return Response.json(result, {
      // Short: hits carry a Spydus set id.
      headers: { "Cache-Control": `public, s-maxage=${SEARCH_TTL_S}, stale-while-revalidate=60` },
    });
  } catch (e) {
    return errorResponse(e, "library/search");
  }
}
