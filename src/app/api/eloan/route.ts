import { cacheLife } from "next/cache";
import { borrowBoxStatus, libbyMatch, type LibbyQuery } from "@/lib/eloans";
import { isBorrowBoxId } from "@/lib/spydus/urls";
import type { EloanStatus } from "@/lib/types";

// Each side is cached on its own; a throw (failure, rate cap) isn't cached and becomes null.
async function cachedBorrowBox(id: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  return borrowBoxStatus(id);
}

async function cachedLibby(q: LibbyQuery) {
  "use cache";
  cacheLife({ stale: 900, revalidate: 3600, expire: 21_600 });
  return libbyMatch(q);
}

const bad = (error: string) =>
  Response.json(
    { error, code: "bad_request" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );

/** GET /api/eloan?type=ebook|audiobook&title=[&bb=&isbn=&author=] : live BorrowBox + Libby status for an e-item. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const type = p.get("type");
  const bb = p.get("bb") || null;
  const isbn = p.get("isbn")?.replace(/-/g, "") || null;
  const title = p.get("title")?.trim() ?? "";
  const author = p.get("author")?.trim() || null;
  if (type !== "ebook" && type !== "audiobook")
    return bad("type must be ebook or audiobook");
  if (bb !== null && !isBorrowBoxId(bb)) return bad("Bad BorrowBox id");
  if (isbn !== null && !/^\d{9}[\dX]$|^\d{13}$/.test(isbn))
    return bad("Bad ISBN");
  if (title.length < 1 || title.length > 200 || (author?.length ?? 0) > 100)
    return bad("Bad title or author");

  const failed = { borrowBox: false, libby: false };
  const settle = <T,>(fn: () => Promise<T>, tag: keyof typeof failed) =>
    fn().catch((e: unknown) => {
      failed[tag] = true;
      console.warn(`[eloan] ${tag}:`, e instanceof Error ? e.message : e);
      return null;
    });
  const [borrowBox, libby] = await Promise.all([
    bb ? settle(() => cachedBorrowBox(bb), "borrowBox") : null,
    settle(() => cachedLibby({ type, isbn, title, author }), "libby"),
  ]);
  const body: EloanStatus = { borrowBox, libby, libbyFailed: failed.libby };
  return Response.json(body, {
    // A failed side shouldn't stick at the CDN.
    headers: { "Cache-Control": failed.borrowBox || failed.libby ? "no-store" : "public, s-maxage=600, stale-while-revalidate=900" },
  });
}
