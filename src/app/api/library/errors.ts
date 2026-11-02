import { BadRequestError, ExpiredResultError, RateLimitedError, SpydusError } from "@/lib/spydus/client";

/** A short, safe reason for an upstream failure ("HTTP 403", "TimeoutError", "ECONNRESET"); no URLs. */
function upstreamReason(e: unknown): string {
  if (e instanceof SpydusError) return e.status ? `HTTP ${e.status}` : e.message; // these messages have no URLs
  const err = e as { name?: string; cause?: { code?: string } } | null;
  return err?.cause?.code ?? err?.name ?? "unknown";
}

/** Error JSON: { error: short message, code }. The UI can show `error` as-is. */
export function errorResponse(e: unknown, tag: string): Response {
  const json = (status: number, code: string, error: string, extra?: object) =>
    Response.json({ error, code, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
  if (e instanceof BadRequestError) return json(400, "bad_request", e.message);
  if (e instanceof RateLimitedError) return json(429, "rate_limited", e.message);
  if (e instanceof ExpiredResultError) return json(410, "expired", e.message);
  console.error(`[${tag}]`, e);
  // `reason` says why the library didn't answer, for diagnosing hosting problems.
  return json(502, "upstream", "Library catalogue unavailable, try again shortly", { reason: upstreamReason(e) });
}
