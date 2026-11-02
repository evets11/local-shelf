import { timingSafeEqual } from "node:crypto";
import { USER_AGENT } from "@/lib/spydus/client";
import { CGI, SPYDUS_BASE } from "@/lib/spydus/urls";

/**
 * GET /api/relay?path=<catalogue path>: fetches one library catalogue page for the nightly sync.
 *
 * The catalogue only answers UK traffic and GitHub's runners are in the US, so the sync goes
 * through this route (Vercel functions run in London, see vercel.json). It's off unless
 * SPYDUS_RELAY_TOKEN is set, needs that token as a Bearer header, and only fetches the
 * catalogue paths the sync itself uses. Pacing stays with the sync.
 */

// The sync's paths: list searches, result pages, full records, holdings, BRN bookmark lookups.
const ALLOWED = new RegExp(
  `^${CGI.replace(/\./g, "\\.")}/(?:ENQ/OPAC/BIBENQ\\?|(?:PAGE|FULL|XHLD)/OPAC/BIBENQ/)`,
);

function authorised(req: Request): boolean {
  const token = process.env.SPYDUS_RELAY_TOKEN;
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || token.length < 32) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  // 404 (not 401) so the relay doesn't advertise itself.
  if (!authorised(req)) return new Response("Not found", { status: 404 });
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!ALLOWED.test(path) || path.includes(".."))
    return new Response("Path not allowed", { status: 400 });

  try {
    const res = await fetch(SPYDUS_BASE + path, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(25_000),
      redirect: "follow",
    });
    // Pass the library's status through, so the sync's retry and back-off rules still apply.
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...(res.headers.get("retry-after") && {
          "Retry-After": res.headers.get("retry-after")!,
        }),
      },
    });
  } catch (e) {
    // Timeouts and network errors: a 504 the sync treats as retryable.
    return new Response(`Relay fetch failed: ${(e as Error).name}`, {
      status: 504,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
