import { cacheLife } from "next/cache";
import { getTitle } from "@/lib/catalog";
import { getLiveAvailability } from "@/lib/spydus/client";
import { errorResponse } from "../../library/errors";

async function liveAvailability(brn: string | null, irn: string) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 900 });
  return getLiveAvailability(brn, irn);
}

export async function GET(_req: Request, ctx: RouteContext<"/api/availability/[irn]">) {
  const { irn } = await ctx.params;
  // Only IRNs we know about; the client also rate-caps and backs off when the library struggles.
  const t = getTitle(irn);
  if (!t) return Response.json({ error: "Unknown title" }, { status: 404 });
  try {
    const data = await liveAvailability(t.brn, irn);
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return errorResponse(e, "availability");
  }
}
