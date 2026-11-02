import { timingSafeEqual } from "node:crypto";
import { USER_AGENT } from "@/lib/spydus/client";
import { CGI, SPYDUS_BASE } from "@/lib/spydus/urls";

/**
 * GET /api/relay?path=<catalogue path>: fetches one library catalogue page for the nightly sync.
 *
 * The catalogue only answers UK traffic and GitHub's runners are in the US, so the sync goes
 * through this route (Vercel functions run in London, see vercel.json). It's off unless
 * SPYDUS_RELAY_TOKEN (32+ characters) is set, needs that token as a Bearer header, and only
 * fetches the catalogue paths the sync itself uses. Pacing stays with the sync.
 */

// Above the sync's longest timeout (90s for list searches and result pages).
export const maxDuration = 100;
const UPSTREAM_TIMEOUT_MS = 95_000;
const MIN_TOKEN_LENGTH = 32;

// The sync's paths: list searches, result pages, full records, holdings, BRN bookmark lookups.
const ALLOWED = new RegExp(
  `^${CGI.replace(/\./g, "\\.")}/(?:ENQ/OPAC/BIBENQ\\?|(?:PAGE|FULL|XHLD)/OPAC/BIBENQ/)`,
);

/** Refusals carry X-Relay-Error so the sync can say "check the relay token", not blame the library. */
const refuse = (status: number, reason: string) =>
  new Response(`Relay: ${reason}`, {
    status,
    headers: { "X-Relay-Error": reason, "Cache-Control": "no-store" },
  });

function authorised(req: Request): boolean {
  const token = process.env.SPYDUS_RELAY_TOKEN;
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || token.length < MIN_TOKEN_LENGTH) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The catalogue URL for `path`, or null if it isn't one the sync uses. Checked after URL parsing. */
function catalogueUrl(path: string): URL | null {
  // Encoded dots could become ".." once fetch() normalises the URL.
  if (!path.startsWith("/") || /\.\.|%2e/i.test(path)) return null;
  let url: URL;
  try {
    url = new URL(path, SPYDUS_BASE);
  } catch {
    return null;
  }
  if (url.origin !== SPYDUS_BASE || !ALLOWED.test(url.pathname + url.search))
    return null;
  return url;
}

export async function GET(req: Request) {
  // 404 (not 401) so the relay doesn't advertise itself.
  if (!authorised(req)) return refuse(404, "unauthorised");
  const url = catalogueUrl(new URL(req.url).searchParams.get("path") ?? "");
  if (!url) return refuse(400, "path not allowed");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      // Stop when the sync gives up too, so a retry never overlaps the request it replaces.
      signal: AbortSignal.any([
        req.signal,
        AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      ]),
      redirect: "follow",
    });
    // Pass the library's status through, so the sync's retry and back-off rules still apply.
    const retryAfter = res.headers.get("retry-after");
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...(retryAfter && { "Retry-After": retryAfter }),
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
